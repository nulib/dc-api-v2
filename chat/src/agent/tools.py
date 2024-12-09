import json

from langchain_core.tools import tool
from setup import opensearch_vector_store

@tool(response_format="content_and_artifact")
def search(query: str):
    """Perform a semantic search of Northwestern University Library digital collections. When answering a search query, ground your answer in the context of the results with references to the document's metadata."""
    query_results = opensearch_vector_store().similarity_search(query, size=20)
    return json.dumps(query_results, default=str), query_results

@tool(response_format="content_and_artifact")
def aggregate(aggregation_query: str):
    """
    Perform a quantitative aggregation on the OpenSearch index.

    Available fields:
    api_link, api_model, ark, collection.title.keyword, contributor.label.keyword, contributor.variants, 
    create_date, creator.variants, date_created, embedding_model, embedding_text_length,
    folder_name, folder_number, genre.variants, id, identifier, indexed_at, language.variants, 
    legacy_identifier, library_unit, location.variants, modified_date, notes.note, notes.type,
    physical_description_material, physical_description_size, preservation_level, provenance, published, publisher, 
    related_url.url, related_url.label, representative_file_set.aspect_ratio, representative_file_set.url, rights_holder,
    series, status, style_period.label.keyword, style_period.variants, subject.label.keyword, subject.role, 
    subject.variants, table_of_contents, technique.label.keyword, technique.variants, title.keyword, visibility, work_type

    Examples:
        - Number of collections: collection.title.keyword
        - Number of works by work type: work_type
    """
    try:
        response = opensearch_vector_store().aggregations_search(aggregation_query)
        return json.dumps(response, default=str), response
    except Exception as e:
        return json.dumps({"error": str(e)}), None
