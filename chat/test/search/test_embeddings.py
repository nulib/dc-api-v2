import io
import json
import os
from unittest import TestCase
from unittest.mock import MagicMock, patch

from search import embeddings
from search.embeddings import EmbeddingError, embed_query


def response(body, **extra):
    return {"Payload": io.BytesIO(json.dumps(body).encode()), **extra}


class TestEmbedQuery(TestCase):
    def setUp(self):
        embeddings.clear_cache()
        self.client = MagicMock()
        patcher = patch("search.embeddings.boto3.client", return_value=self.client)
        patcher.start()
        self.addCleanup(patcher.stop)
        env = patch.dict(os.environ, {"EMBEDDING_FUNCTION": "embed-function:live"})
        env.start()
        self.addCleanup(env.stop)
        self.addCleanup(embeddings.clear_cache)

    def test_invokes_the_embed_function_with_the_query_text(self):
        self.client.invoke.return_value = response({"embeddings": [[0.1, 0.2]]})

        self.assertEqual(embed_query("jazz posters"), [0.1, 0.2])
        self.client.invoke.assert_called_once()
        kwargs = self.client.invoke.call_args.kwargs
        self.assertEqual(kwargs["FunctionName"], "embed-function:live")
        self.assertEqual(
            json.loads(kwargs["Payload"]), {"texts": ["jazz posters"], "task": "query"}
        )

    def test_caches_embeddings_by_query_text(self):
        self.client.invoke.side_effect = lambda **_: response({"embeddings": [[1, 0]]})

        embed_query("jazz posters")
        embed_query("jazz posters")
        embed_query("blues posters")

        self.assertEqual(self.client.invoke.call_count, 2)

    def test_does_not_cache_failures(self):
        self.client.invoke.side_effect = [
            RuntimeError("throttled"),
            response({"embeddings": [[1, 0]]}),
        ]

        with self.assertRaises(EmbeddingError):
            embed_query("jazz")
        self.assertEqual(embed_query("jazz"), [1, 0])

    def test_function_error(self):
        self.client.invoke.return_value = response(
            {"errorMessage": "session failed"}, FunctionError="Unhandled"
        )
        with self.assertRaisesRegex(EmbeddingError, "Embedding function failed"):
            embed_query("jazz")

    def test_rejected_request(self):
        self.client.invoke.return_value = response({"error": "`texts` must be"})
        with self.assertRaisesRegex(EmbeddingError, "`texts` must be"):
            embed_query("jazz")

    def test_no_embedding_returned(self):
        self.client.invoke.return_value = response({"embeddings": []})
        with self.assertRaises(EmbeddingError):
            embed_query("jazz")

    def test_function_not_configured(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(EmbeddingError, "not configured"):
                embed_query("jazz")
        self.client.invoke.assert_not_called()
