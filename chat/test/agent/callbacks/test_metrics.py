from unittest import TestCase
from unittest.mock import patch
import sys

sys.path.append("./src")

from agent.callbacks.metrics import MetricsCallbackHandler

class TestSocketCallbackHandler(TestCase):
    def setUp(self):
        self.ref = "test_ref"
        self.handler = MetricsCallbackHandler()

    def test_on_llm_end_with_content(self):
        # Mocking LLMResult and Generations
        class MockMessage:
            def __init__(self, text, response_metadata={}, usage_metadata={}):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata
                self.usage_metadata = usage_metadata

        class MockLLMResult:
            def __init__(self, text, stop_reason="end_turn"):
                response_metadata = {"stop_reason": stop_reason}
                usage_metadata = {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30}
                message = MockMessage(text, response_metadata, usage_metadata)
                self.generations = [[message]]

        # When response has content and end_turn stop reason
        response = MockLLMResult("Here is the answer", stop_reason="end_turn")
        with patch.object(self.handler, "on_llm_end", wraps=self.handler.on_llm_end) as mock:
            self.handler.on_llm_end(response)
            mock.assert_called_once_with(response)
            self.assertEqual(self.handler.answers, ["Here is the answer"])
            self.assertEqual(self.handler.accumulator, {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30})

    def test_on_tool_end_search(self):
        # Mock tool output
        class MockDoc:
            def __init__(self, metadata):
                self.metadata = metadata

        class MockToolMessage:
            def __init__(self, name, artifact):
                self.name = name
                self.artifact = artifact

        artifact = [
            MockDoc(
                {
                    "id": 1,
                    "api_link": "https://example.edu/item/1",
                    "title": "Result 1",
                    "visibility": "public",
                    "work_type": "article",
                    "thumbnail": "img1",
                }
            ),
            MockDoc(
                {
                    "id": 2,
                    "api_link": "https://example.edu/item/2",
                    "title": "Result 2",
                    "visibility": "private",
                    "work_type": "document",
                    "thumbnail": "img2",
                }
            ),
        ]

        output = MockToolMessage("search", artifact)
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [{"type": "source_urls", "artifact": ["https://example.edu/item/1", "https://example.edu/item/2"]}])

    def test_on_tool_end_aggregate(self):
        class MockToolMessage:
            def __init__(self, name, artifact):
                self.name = name
                self.artifact = artifact

        output = MockToolMessage("aggregate", {"aggregation_result": {"count": 10}})
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [{"type": "aggregation", "artifact": {"count": 10}}])

    def test_on_tool_end_discover_fields(self):
        class MockToolMessage:
            def __init__(self, name, artifact):
                self.name = name
                self.artifact = artifact

        output = MockToolMessage("discover_fields", {})
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [])
