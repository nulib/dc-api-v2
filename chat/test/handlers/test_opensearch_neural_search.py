# ruff: noqa: E402
import sys
sys.path.append('./src')

from unittest import TestCase
from handlers.opensearch_neural_search import OpenSearchNeuralSearch
from langchain_core.documents import Document

class MockClient():
    def search(self, index, body, params):
        return {
          "hits": {
            "hits": [
              {
                "_source": {
                  "id": "test"
                },
                "_score": 0.12345
              }
            ]
          }
        }

class TestOpenSearchNeuralSearch(TestCase):
    def test_similarity_search(self):
        docs = OpenSearchNeuralSearch(client=MockClient(), endpoint="test", index="test", model_id="test").similarity_search(query="test", subquery={"_source": {"excludes": ["embedding"]}}, size=10)
        self.assertEqual(docs, [Document(page_content='test', metadata={'id': 'test'})])
        
    def test_similarity_search_with_score(self):
        docs = OpenSearchNeuralSearch(client=MockClient(), endpoint="test", index="test", model_id="test").similarity_search_with_score(query="test")
        self.assertEqual(docs, [(Document(page_content='test', metadata={'id': 'test'}), 0.12345)])
    
    def test_add_texts(self):
      try:
        OpenSearchNeuralSearch(client=MockClient(), endpoint="test", index="test", model_id="test").add_texts(texts=["test"], metadatas=[{"id": "test"}])
      except Exception as e:
          self.fail(f"from_texts raised an exception: {e}")
          
    def test_from_texts(self):
      try:
        OpenSearchNeuralSearch.from_texts(clas="test", texts=["test"], metadatas=[{"id": "test"}])
      except Exception as e:
          self.fail(f"from_texts raised an exception: {e}")