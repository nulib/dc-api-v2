import json

from langchain_core.tools import tool
from setup import opensearch_vector_store

def get_keyword_fields(properties, prefix=''):
    """
    Filters a nested list of opensearch mappings and returns a flat list of keyword fields
    """
    keyword_fields = []
    for field_name, field_mapping in properties.items():
        current_path = f"{prefix}{field_name}"
        if field_mapping.get('type') == 'keyword':
            keyword_fields.append(current_path)
        if 'fields' in field_mapping:
            for subfield_name, subfield_mapping in field_mapping['fields'].items():
                if subfield_mapping.get('type') == 'keyword':
                    keyword_fields.append(f"{current_path}.{subfield_name}")
        if 'properties' in field_mapping:
            nested_properties = field_mapping['properties']
            keyword_fields.extend(get_keyword_fields(nested_properties, prefix=current_path + '.'))
    return keyword_fields

@tool(response_format="content_and_artifact")
def discover_fields():
    """
    Discover the fields available in the OpenSearch index. This tool is useful for understanding the structure of the index and the fields available for aggregation queries.
    """
    # filter fields that are not useful for aggregation (only include keyword fields)
    opensearch = opensearch_vector_store()
    fields = opensearch.client.indices.get_mapping(index=opensearch.index)
    top_properties = list(fields.values())[0]['mappings']['properties']
    result = get_keyword_fields(top_properties)
    return json.dumps(result, default=str), result

@tool(response_format="content_and_artifact")
def search(query: str):
    """Perform a semantic search of Northwestern University Library digital collections. When answering a search query, ground your answer in the context of the results with references to the document's metadata."""
    query_results = opensearch_vector_store().similarity_search(query, size=20)
    return json.dumps(query_results, default=str), query_results

@tool(response_format="content_and_artifact")
def aggregate(agg_field: str, term_field: str, term: str):
    """
    Perform a quantitative aggregation on the OpenSearch index.
    
    Args:
        agg_field (str): The field to aggregate on.
        term_field (str): The field to filter on.
        term (str): The term to filter on.
    
    Leave term_field and term empty to aggregate across the entire index.

    Available fields:
    You must use the discover_fields tool first to obtain the list of appropriate fields for aggregration in the index.
    
    Do not use any fields that do not exist in the list returned by discover_fields!
    """
    try:
        response = opensearch_vector_store().aggregations_search(agg_field, term_field, term)
        return json.dumps(response, default=str), response
    except Exception as e:
        return json.dumps({"error": str(e)}), None
