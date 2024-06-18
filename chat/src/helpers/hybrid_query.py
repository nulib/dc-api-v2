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

def hybrid_query(query: str, model_id: str, vector_field: str = "embedding", k: int = 10, subquery: Any = None, **kwargs: Any):
    result = {
        "size": k,
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
        }
    }
    
    if subquery:
        result["query"]["hybrid"]["queries"].append(filter(subquery))

    for key, value in kwargs.items():
        result[key] = value
        
    return result

    