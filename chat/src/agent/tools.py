import json

from langchain_core.tools import tool
from core.setup import opensearch_vector_store
from typing import List

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

def filter_results(results):
    """
    Filters out the embeddings from the results
    """
    filtered = []
    for result in results:
        doc = result.metadata
        if 'embedding' in doc:
            doc.pop('embedding')
        filtered.append(doc)
    return filtered

@tool(response_format="content")
def discover_fields():
    """
    Discover the fields available in the OpenSearch index. This tool is useful for understanding the structure of the index and the fields available for aggregation queries.
    """
    # filter fields that are not useful for aggregation (only include keyword fields)
    opensearch = opensearch_vector_store()
    fields = opensearch.client.indices.get_mapping(index=opensearch.index)
    top_properties = list(fields.values())[0]['mappings']['properties']
    result = get_keyword_fields(top_properties)
    return result

@tool(response_format="content")
def search(query: str):
    """Perform a semantic search of Northwestern University Library digital collections. When answering a search query, ground your answer in the context of the results with references to the document's metadata."""
    query_results = opensearch_vector_store().similarity_search(query, size=20)
    return filter_results(query_results)

@tool(response_format="content")
def aggregate(agg_field: str, term_field: str, term: str):
    """
    Perform a quantitative aggregation on the OpenSearch index. Use this tool for quantitative questions like "How many...?" or "What are the most common...?"
    
    Args:
        agg_field (str): The field to aggregate on.
        term_field (str): The field to filter on.
        term (str): The term to filter on.
    
    Leave term_field and term empty to aggregate across the entire index.

    Available fields:
    You must use the discover_fields tool first to obtain the list of appropriate fields for aggregration in the index.
    
    Do not use any fields that do not exist in the list returned by discover_fields!
    
    See sum_other_doc_count to get the total count of documents, even if the aggregation is limited by size.
    """
    try:
        response = opensearch_vector_store().aggregations_search(agg_field, term_field, term)
        return response
    except Exception as e:
        return json.dumps({"error": str(e)})

@tool(response_format="content")
def retrieve_documents(doc_ids: List[str]):
    """
    Retrieve documents from the OpenSearch index based on a list of document IDs. 

    Use this instead of the search tool if the user has provided docs for context
    and you need the full metadata, or if you're working with output from another
    tool that only contains document IDs. 
    Provide an answer to their question based on the metadata of the documents.


    Args:
        doc_ids (List[str]): A list of document IDs to fetch.

    Returns:
        A JSON list of documents that match the given IDs.
    """
    
    try:
        response = opensearch_vector_store().retrieve_documents(doc_ids)
        return filter_results(response)
    except Exception as e:
        return {"error": str(e)}
