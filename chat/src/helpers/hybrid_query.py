from typing import Any

def filter(query: dict):
    return {
        "bool": {
            "must": [
                query,
                { "terms": { "visibility": ["Public", "Institution"] } },
                { "term": { "published": True } }
            ]
        }
    }

def hybrid_query(query: str, model_id: str, vector_field: str = "embedding", k: int = 10, **kwargs: Any):
    result = {
        "size": kwargs.get("size", 5),
        "query": {
            "hybrid": {
                "queries": [
                    filter({
                        "query_string": {
                            "default_operator": "AND",
                            "fields": ["title^5", "all_controlled_labels", "all_ids^5"], 
                            "query": query
                        }
                    }),
                    filter({
                        "neural": {
                            vector_field: {
                                "k": k, 
                                "model_id": model_id,
                                "query_text": query
                            }
                        }
                    })
                ]
            },
        },
        "search_pipeline": {
            "phase_results_processors": [
                {
                    "normalization-processor": {
                        "combination": {
                            "parameters": {
                                "weights": [0.25, 0.75]
                            },
                            "technique": "arithmetic_mean"
                        },
                        "normalization": {
                            "technique": "l2"
                        }
                    }
                }
            ]
        }
    }
    
    for key, value in kwargs.items():
        result[key] = value
    
    return result
