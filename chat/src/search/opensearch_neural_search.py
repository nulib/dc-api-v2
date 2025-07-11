from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from opensearchpy import OpenSearch
from typing import Any, List, Tuple
from search.hybrid_query import hybrid_query, filter


class OpenSearchNeuralSearch(VectorStore):
    """Read-only OpenSearch vectorstore with neural search."""

    def __init__(
        self,
        endpoint: str,
        index: str,
        model_id: str,
        client: OpenSearch = None,
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
        self, query: str, k: int = 10, facets: list = None, **kwargs: Any
    ) -> List[Document]:
        """Return docs most similar to the embedding vector."""
        docs_with_scores = self.similarity_search_with_score(query, k, facets=facets, **kwargs)
        return [doc[0] for doc in docs_with_scores]

    def similarity_search_with_score(
        self, query: str, k: int = 10, facets: list = None, **kwargs: Any
    ) -> List[Tuple[Document, float]]:
        """Return docs most similar to query."""
        if facets is not None:
            kwargs['facets'] = facets
            
        dsl = hybrid_query(
            query=query,
            model_id=self.model_id,
            vector_field=self.vector_field,
            k=k,
            **kwargs,
        )
        response = self.client.search(
            index=self.index,
            body=dsl,
            params={"search_pipeline": self.search_pipeline}
            if self.search_pipeline
            else None,
        )
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

    def aggregations_search(
        self, agg_field: str, term_field: str = None, term: str = None, facets: list = None, **kwargs: Any
    ) -> dict:
        """Perform a search with aggregations and return the aggregation results."""
        base_query = (
            {"match_all": {}}
            if (term is None or term == "")
            else {"match": {term_field: term}}
        )
        filtered_query = filter(base_query, facets)

        dsl = {
            "size": 0,
            "query": filtered_query,
            "aggs": {"aggregation_result": {"terms": {"field": agg_field}}},
        }

        response = self.client.search(
            index=self.index,
            body=dsl,
            params=(
                {"search_pipeline": self.search_pipeline}
                if self.search_pipeline
                else None
            ),
        )

        return response.get("aggregations", {})

    def retrieve_documents(self, doc_ids: List[str]) -> List[Document]:
        """Retrieve documents from the OpenSearch index based on a list of document IDs."""
        query = {"query": {"ids": {"values": doc_ids}}}

        response = self.client.search(index=self.index, body=query, size=len(doc_ids))
        documents = [
            Document(
                page_content=hit["_source"][self.text_field], metadata=hit["_source"]
            )
            for hit in response["hits"]["hits"]
        ]
        return documents

    def add_texts(self, texts: List[str], metadatas: List[dict], **kwargs: Any) -> None:
        pass

    @classmethod
    def from_texts(cls, texts: List[str], metadatas: List[dict], **kwargs: Any) -> None:
        pass
