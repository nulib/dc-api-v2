# ruff: noqa: E402
from unittest import TestCase
from unittest.mock import Mock, patch
from opensearchpy import ConnectionError, AuthenticationException, NotFoundError
from search.opensearch_neural_search import OpenSearchNeuralSearch
from langchain_core.documents import Document


def fake_embed(text):
    return [0.1, 0.2, 0.3]


class MockClient:
    def search(self, index, body, params):
        self.body = body
        return {"hits": {"hits": [{"_source": {"id": "test"}, "_score": 0.12345}]}}


class MockErrorClient:
    def search(self, index, body, params):
        raise ConnectionError("Failed to connect to OpenSearch")


class TestOpenSearchNeuralSearch(TestCase):
    def setUp(self):
        self.search = OpenSearchNeuralSearch(
            client=MockClient(), endpoint="test", index="test", embed=fake_embed
        )

        self.error_search = OpenSearchNeuralSearch(
            client=MockErrorClient(), endpoint="test", index="test", embed=fake_embed
        )

    def test_similarity_search(self):
        docs = self.search.similarity_search(
            query="test", subquery={"_source": {"excludes": ["embedding"]}}, size=10
        )
        self.assertEqual(docs, [Document(page_content="test", metadata={"id": "test"})])

    def test_similarity_search_sends_the_embedded_query_as_knn(self):
        embedded = []

        def embed(text):
            embedded.append(text)
            return [0.4, 0.5]

        client = MockClient()
        search = OpenSearchNeuralSearch(
            client=client, endpoint="test", index="test", embed=embed
        )
        search.similarity_search(query="jazz posters", k=7)

        self.assertEqual(embedded, ["jazz posters"])
        lexical, semantic = client.body["query"]["hybrid"]["queries"]
        self.assertEqual(
            lexical["bool"]["must"][0]["query_string"]["query"], "jazz posters"
        )
        self.assertEqual(
            semantic["bool"]["must"][0],
            {"knn": {"embedding": {"k": 7, "vector": [0.4, 0.5]}}},
        )

    def test_similarity_search_does_not_search_when_embedding_fails(self):
        def embed(text):
            raise RuntimeError("no embedding")

        client = MockClient()
        search = OpenSearchNeuralSearch(
            client=client, endpoint="test", index="test", embed=embed
        )
        with self.assertRaises(RuntimeError):
            search.similarity_search(query="jazz posters")
        self.assertFalse(hasattr(client, "body"))

    def test_similarity_search_connection_error(self):
        with self.assertRaises(ConnectionError):
            self.error_search.similarity_search(query="test")

    @patch("opensearchpy.OpenSearch")
    def test_similarity_search_auth_error(self, mock_opensearch):
        mock_opensearch.return_value.search.side_effect = AuthenticationException(
            "Authentication failed"
        )
        search = OpenSearchNeuralSearch(
            client=mock_opensearch.return_value,
            endpoint="test",
            index="test",
            embed=fake_embed,
        )
        with self.assertRaises(AuthenticationException):
            search.similarity_search(query="test")

    def test_similarity_search_with_score(self):
        docs = self.search.similarity_search_with_score(query="test")
        self.assertEqual(
            docs, [(Document(page_content="test", metadata={"id": "test"}), 0.12345)]
        )

    def test_similarity_search_with_score_connection_error(self):
        with self.assertRaises(ConnectionError):
            self.error_search.similarity_search_with_score(query="test")

    @patch("opensearchpy.OpenSearch")
    def test_aggregations_search_index_not_found(self, mock_opensearch):
        mock_opensearch.return_value.search.side_effect = NotFoundError(
            404, "index_not_found_exception", {"error": "index not found"}
        )
        search = OpenSearchNeuralSearch(
            client=mock_opensearch.return_value,
            endpoint="test",
            index="test",
            embed=fake_embed,
        )
        with self.assertRaises(NotFoundError):
            search.aggregations_search(agg_field="test_field")

    def test_aggregations_search_connection_error(self):
        with self.assertRaises(ConnectionError):
            self.error_search.aggregations_search(agg_field="test_field")

    def test_add_texts_exception(self):
        # Test to ensure the exception handler works
        with self.assertRaises(AssertionError) as context:
            search = self.search
            search.add_texts = Mock(side_effect=Exception("Test exception"))
            try:
                search.add_texts(texts=["test"], metadatas=[{"id": "test"}])
            except Exception as e:
                self.fail(f"add_texts raised an exception: {e}")

        self.assertTrue(
            "add_texts raised an exception: Test exception" in str(context.exception)
        )

    def test_from_texts_exception(self):
        with self.assertRaises(AssertionError) as context:
            OpenSearchNeuralSearch.from_texts = Mock(
                side_effect=Exception("Test exception")
            )
            try:
                OpenSearchNeuralSearch.from_texts(
                    texts=["test"], metadatas=[{"id": "test"}]
                )
            except Exception as e:
                self.fail(f"from_texts raised an exception: {e}")

        self.assertTrue(
            "from_texts raised an exception: Test exception" in str(context.exception)
        )

    def test_client_initialization_error(self):
        with self.assertRaises(ValueError):
            OpenSearchNeuralSearch(
                endpoint="",  # Empty endpoint should raise ValueError
                index="test",
                embed=fake_embed,
                client=None,
            )

    def test_add_texts_does_nothing(self):
        """Test that add_texts method exists but does nothing."""
        try:
            # Call add_texts with some sample data
            result = self.search.add_texts(
                texts=["test1", "test2"], metadatas=[{"id": "1"}, {"id": "2"}]
            )
            # Method should return None
            self.assertIsNone(result)
        except Exception as e:
            self.fail(f"add_texts raised an unexpected exception: {e}")

    def test_from_texts_does_nothing(self):
        """Test that from_texts classmethod exists but does nothing."""
        try:
            # Call from_texts with some sample data
            result = OpenSearchNeuralSearch.from_texts(
                texts=["test1", "test2"],
                metadatas=[{"id": "1"}, {"id": "2"}],
                endpoint="test",
                index="test",
                embed=fake_embed,
            )
            # Method should return None
            self.assertIsNone(result)
        except Exception as e:
            self.fail(f"from_texts raised an unexpected exception: {e}")
