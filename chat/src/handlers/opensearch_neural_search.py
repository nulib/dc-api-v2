from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStore
from opensearchpy import OpenSearch

class OpensearchNeuralSearch(VectorStore):
  """Read-only OpenSearch vectorstore with neural search."""

  def __init__(
    self,
    endpoint: str,
    index: str,
    model_id: str,
    vector_field: str = "embedding",
    search_pipeline: str = None,
    **kwargs: Any
  ):
    self.client = OpenSearch(hosts=[{"host": endpoint, "port": "443", "use_ssl": True}], **kwargs)
    self.index = index
    self.model_id = model_id
    self.vector_field = vector_field
    self.search_pipeline = search_pipeline

  # Allow for hybrid searching
  # Allow for different types of searches
  # Allow for _source override

  def similarity_search(
    self,
    query: str,
    k: int = 10,
    subquery: Any = None,
    **kwargs: Any
  ) -> List[Document]:
    """Return docs most similar to query."""
    dsl = {
      'size': k,
      'query': {
        'hybrid': {
          'queries': [
            {
              'neural': {
                self.vector_field: {
                  'query_text': query,
                  'model_id': self.model_id,
                  'k': k
                }
              }
            }
          ]
        }
      }
    }

    if (subquery):
      dsl['query']['hybrid']['queries'].append(subquery)
  
    for key, value in kwargs.items():
      dsl[key] = value

    response = self.client.search(index=self.index, body=dsl)