from unittest import TestCase
from unittest.mock import patch
import json
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
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = json.dumps(content)

        content = [
            {
                "id": 1,
                "api_link": "https://example.edu/item/1",
                "title": "Result 1",
                "visibility": "public",
                "work_type": "article",
                "thumbnail": "img1",
            },
            {
                "id": 2,
                "api_link": "https://example.edu/item/2",
                "title": "Result 2",
                "visibility": "private",
                "work_type": "document",
                "thumbnail": "img2",
            },
        ]

        output = MockToolMessage("search", content)
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [{"type": "source_urls", "artifact": ["https://example.edu/item/1", "https://example.edu/item/2"]}])

    def test_on_tool_end_aggregate(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = json.dumps(content)

        output = MockToolMessage("aggregate", {"aggregation_result": {"count": 10}})
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [{"type": "aggregation", "artifact": {"count": 10}}])

    def test_on_tool_end_discover_fields(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = json.dumps(content)

        output = MockToolMessage("discover_fields", {})
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [])
    
    def test_on_llm_end_with_none_response(self):
        self.handler.on_llm_end(None)
        self.assertEqual(self.handler.answers, [])
        self.assertEqual(self.handler.accumulator, {})
    
    def test_on_llm_end_with_empty_generations(self):
        class MockLLMResult:
            generations = [[]]  # Empty list

        response = MockLLMResult()
        self.handler.on_llm_end(response)
        self.assertEqual(self.handler.answers, [])
        self.assertEqual(self.handler.accumulator, {})
    
    def test_on_llm_end_with_empty_text(self):
        class MockMessage:
            def __init__(self):
                self.text = ""
                self.message = self
                self.usage_metadata = {"input_tokens": 5}

        class MockLLMResult:
            generations = [[MockMessage()]]

        response = MockLLMResult()
        self.handler.on_llm_end(response)
        self.assertEqual(self.handler.answers, [])
        self.assertEqual(self.handler.accumulator, {"input_tokens": 5})
    
    def test_on_llm_end_missing_message(self):
        class MockMessage:
            def __init__(self):
                self.text = "No message attribute"

        class MockLLMResult:
            generations = [[MockMessage()]]

        response = MockLLMResult()
        self.handler.on_llm_end(response)
        self.assertEqual(self.handler.answers, ["No message attribute"])
        self.assertEqual(self.handler.accumulator, {})
    
    def test_on_tool_end_invalid_json(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = content

        # Invalid content with a mocked `metadata` attribute
        invalid_content = 'example_content'

        output = MockToolMessage("search", invalid_content)

        with patch("builtins.print") as mock_print:
            self.handler.on_tool_end(output)
            mock_print.assert_called_once_with(
                "Invalid json (Expecting value: line 1 column 1 (char 0)) returned from search tool: example_content"
            )
            self.assertEqual(self.handler.artifacts, [])

    def test_on_tool_end_unrecognized_tool(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = json.dumps(content)

        output = MockToolMessage("unknown_tool", {})
        self.handler.on_tool_end(output)
        self.assertEqual(self.handler.artifacts, [])

    def test_on_llm_end_with_none_metadata(self):
        """
        Test the on_llm_end method when usage_metadata is None.
        Ensures that answers are processed correctly and accumulator remains unchanged.
        """
        # Mocking LLMResult with usage_metadata as None
        class MockMessage:
            def __init__(self, text, usage_metadata=None):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.usage_metadata = usage_metadata

        class MockLLMResult:
            def __init__(self, text):
                message = MockMessage(text, usage_metadata=None)
                self.generations = [[message]]

        response = MockLLMResult("Answer without metadata")
        with patch.object(self.handler, "on_llm_end", wraps=self.handler.on_llm_end) as mock:
            self.handler.on_llm_end(response)
            mock.assert_called_once_with(response)
            self.assertEqual(self.handler.answers, ["Answer without metadata"])
            self.assertEqual(self.handler.accumulator, {})