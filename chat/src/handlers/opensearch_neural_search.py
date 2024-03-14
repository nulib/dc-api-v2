from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from opensearchpy import OpenSearch
from typing import Any, List, Tuple


class OpenSearchNeuralSearch(VectorStore):
    """Read-only OpenSearch vectorstore with neural search."""

    def __init__(
        self,
        client: None,
        endpoint: str,
        index: str,
        model_id: str,
        vector_field: str = "embedding",
        search_pipeline: str = None,
        text_field: str = "id",
        **kwargs: Any,
    ):
        self.client = client or OpenSearch(
            hosts=[{"host": endpoint, "port": "443", "use_ssl": True}], **kwargs
        )
        self.index = index
        self.model_id = model_id
        self.vector_field = vector_field
        self.search_pipeline = search_pipeline
        self.text_field = text_field

    def similarity_search(
        self, query: str, k: int = 10, subquery: Any = None, **kwargs: Any
    ) -> List[Document]:
        """Return docs most similar to the embedding vector."""
        docs_with_scores = self.similarity_search_with_score(
            query, k, subquery, **kwargs
        )
        return [doc[0] for doc in docs_with_scores]

    def similarity_search_with_score(
        self, query: str, k: int = 10, subquery: Any = None, **kwargs: Any
    ) -> List[Tuple[Document, float]]:
        """Return docs most similar to query."""
        dsl = {
            "size": k,
            "query": {
                "hybrid": {
                    "queries": [
                        {
                            "neural": {
                                self.vector_field: {
                                    "query_text": query,
                                    "model_id": self.model_id,
                                    "k": k,
                                }
                            }
                        }
                    ]
                }
            },
        }

        if subquery:
            dsl["query"]["hybrid"]["queries"].append(subquery)

        for key, value in kwargs.items():
            dsl[key] = value

        response = self.client.search(index=self.index, body=dsl, params={"search_pipeline": self.search_pipeline} if self.search_pipeline else None)

        documents_with_scores = [
            (
                Document(
                    page_content=hit["_source"][self.text_field],
                    metadata=(hit["_source"]),
                ),
                hit["_score"],
            )
            for hit in response["hits"]["hits"]
        ]

        return documents_with_scores
    
    def add_texts(self, texts: List[str], metadatas: List[dict], **kwargs: Any) -> None:
       pass
    
    @classmethod
    def from_texts(cls, texts: List[str], metadatas: List[dict], **kwargs: Any) -> None:
       pass