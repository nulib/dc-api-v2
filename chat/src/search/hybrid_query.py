from typing import Any


def filter(query: dict, facets: list = None):
    must_clauses = [
        query,
        {"terms": {"visibility": ["Public", "Institution"]}},
        {"term": {"published": True}},
    ]
    
    if facets:
        for facet in facets:
            for field, values in facet.items():
                if isinstance(values, list) and len(values) > 1:
                    must_clauses.append({"terms": {field: values}})
                elif isinstance(values, list) and len(values) == 1:
                    must_clauses.append({"term": {field: values[0]}})
                else:
                    must_clauses.append({"term": {field: values}})
    
    return {
        "bool": {
            "must": must_clauses
        }
    }


def hybrid_query(
    query: str,
    model_id: str,
    vector_field: str = "embedding",
    k: int = 40,
    facets: list = None,
    **kwargs: Any,
):
    result = {
        "size": kwargs.get("size", 20),
        "_source": {
            "include": [
                "abstract",
                "accession_number",
                "alternate_title",
                "api_link",
                "ark",
                "canonical_link",
                "collection",
                "contributor",
                "creator",
                "date_created_edtf",
                "description",
                "genre",
                "id",
                "iiif_manifest",
                "language",
                "library_unit",
                "license",
                "location",
                "physical_description_material",
                "physical_description_size",
                "provenance",
                "publisher",
                "rights_holder",
                "rights_statement",
                "scope_and_contents",
                "series",
                "style_period",
                "subject",
                "table_of_contents",
                "technique",
                "thumbnail",
                "title",
                "visibility",
                "work_type",
            ],
            "exclude": ["embedding", "embedding_model"],
        },
        "query": {
            "hybrid": {
                "queries": [
                    filter(
                        {
                            "query_string": {
                                "default_operator": "OR",
                                "fields": [
                                    "title^10",
                                    "collection.title^5",
                                    "all_controlled_labels",
                                    "all_ids^10",
                                ],
                                "query": query,
                            }
                        },
                        facets
                    ),
                    filter(
                        {
                            "neural": {
                                vector_field: {
                                    "k": k,
                                    "model_id": model_id,
                                    "query_text": query,
                                }
                            }
                        },
                        facets
                    ),
                ]
            },
        },
        "search_pipeline": {
            "phase_results_processors": [
                {
                    "normalization-processor": {
                        "combination": {
                            "parameters": {"weights": [0.25, 0.75]},
                            "technique": "arithmetic_mean",
                        },
                        "normalization": {"technique": "l2"},
                    }
                }
            ]
        },
    }

    for key, value in kwargs.items():
        result[key] = value

    return result
