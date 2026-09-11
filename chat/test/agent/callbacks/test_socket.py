import unittest
from unittest import TestCase
from unittest.mock import MagicMock
import sys

sys.path.append("./src")

from agent.callbacks.socket import SocketCallbackHandler


class MockClient:
    def __init__(self):
        self.received = []

    def post_to_connection(self, Data, ConnectionId):
        self.received.append(Data)
        return Data


class TestSocketCallbackHandler(TestCase):
    def setUp(self):
        self.mock_socket = MagicMock()
        self.ref = "test_ref"
        self.handler = SocketCallbackHandler(socket=self.mock_socket, ref=self.ref)

    def test_on_llm_start(self):
        # Given metadata that includes model name
        metadata = {"ls_model_name": "test_model"}

        # When on_llm_start is called
        self.handler.on_llm_start(serialized={}, prompts=["Hello"], metadata=metadata)

        # Then verify the socket was called with the correct start message
        self.mock_socket.send.assert_called_once_with(
            {"type": "start", "ref": self.ref, "message": {"model": "test_model"}}
        )

    def test_on_llm_end_with_content(self):
        # Mocking LLMResult and Generations
        class MockMessage:
            def __init__(self, text, response_metadata):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata

        class MockLLMResult:
            def __init__(self, text, stop_reason="end_turn"):
                self.generations = [[MockMessage(text, {"stop_reason": stop_reason})]]

        # When response has content and end_turn stop reason
        response = MockLLMResult("Here is the answer", stop_reason="end_turn")
        self.handler.on_llm_end(response)

        # Verify "stop" and "answer" and then "final_message" were sent
        expected_calls = [
            unittest.mock.call({"type": "stop", "ref": self.ref}),
            unittest.mock.call(
                {"type": "answer", "ref": self.ref, "message": "Here is the answer"}
            ),
            unittest.mock.call({"type": "final_message", "ref": self.ref}),
        ]
        self.mock_socket.send.assert_has_calls(expected_calls, any_order=False)

    def test_on_llm_end_truncated_by_max_tokens(self):
        # Mocking a response Bedrock cut off at the max_tokens limit
        class MockMessage:
            def __init__(self, text, response_metadata):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata
                self.tool_calls = []

        class MockLLMResult:
            def __init__(self, text, stop_reason):
                self.generations = [[MockMessage(text, {"stop_reason": stop_reason})]]

        response = MockLLMResult("A truncated ans", stop_reason="max_tokens")
        self.handler.on_llm_end(response)

        # A truncated turn is still over, so the client must get "final_message"
        # or it waits on a response that will never arrive
        self.mock_socket.send.assert_has_calls(
            [unittest.mock.call({"type": "final_message", "ref": self.ref})]
        )

    def test_on_llm_end_with_tool_calls(self):
        # Mocking a response that stopped to call a tool
        class MockMessage:
            def __init__(self, text, response_metadata, tool_calls):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata
                self.tool_calls = tool_calls

        class MockLLMResult:
            def __init__(self, text, stop_reason, tool_calls):
                self.generations = [
                    [MockMessage(text, {"stop_reason": stop_reason}, tool_calls)]
                ]

        tool_calls = [{"name": "search", "args": {}, "id": "call_1"}]
        response = MockLLMResult("", stop_reason="tool_use", tool_calls=tool_calls)
        self.handler.on_llm_end(response)

        # The agent keeps working, so the turn is not final yet
        self.assertNotIn(
            unittest.mock.call({"type": "final_message", "ref": self.ref}),
            self.mock_socket.send.mock_calls,
        )

    def test_on_llm_end_truncated_mid_tool_call(self):
        # Mocking a response cut off at max_tokens while emitting a tool call
        class MockMessage:
            def __init__(self, text, response_metadata, tool_calls):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata
                self.tool_calls = tool_calls

        class MockLLMResult:
            def __init__(self, text, stop_reason, tool_calls):
                self.generations = [
                    [MockMessage(text, {"stop_reason": stop_reason}, tool_calls)]
                ]

        tool_calls = [{"name": "search", "args": {}, "id": "call_1"}]
        response = MockLLMResult("", stop_reason="max_tokens", tool_calls=tool_calls)
        self.handler.on_llm_end(response)

        # The graph routes on tool_calls, not the stop reason, so it keeps going
        self.assertNotIn(
            unittest.mock.call({"type": "final_message", "ref": self.ref}),
            self.mock_socket.send.mock_calls,
        )

    def test_on_llm_end_unparseable_tool_call(self):
        # Mocking a "tool_use" stop whose arguments failed to parse, so the call
        # landed in invalid_tool_calls and tool_calls came back empty
        class MockMessage:
            def __init__(self, text, response_metadata, tool_calls):
                self.text = text
                self.message = self  # For simplicity, reuse same object for .message
                self.response_metadata = response_metadata
                self.tool_calls = tool_calls

        class MockLLMResult:
            def __init__(self, text, stop_reason, tool_calls):
                self.generations = [
                    [MockMessage(text, {"stop_reason": stop_reason}, tool_calls)]
                ]

        response = MockLLMResult("", stop_reason="tool_use", tool_calls=[])
        self.handler.on_llm_end(response)

        # should_continue routes on tool_calls, so the graph ends here despite the
        # "tool_use" stop reason and the client still needs "final_message"
        self.mock_socket.send.assert_has_calls(
            [unittest.mock.call({"type": "final_message", "ref": self.ref})]
        )

    def test_on_llm_new_token(self):
        # When a new token arrives
        self.handler.on_llm_new_token("hello")

        # Then verify the socket sent a token message
        self.mock_socket.send.assert_called_once_with(
            {"type": "token", "ref": self.ref, "message": "hello"}
        )

    def test_on_tool_start(self):
        # When tool starts
        self.handler.on_tool_start({"name": "test_tool"}, "input_value")

        # Verify the tool_start message
        self.mock_socket.send.assert_called_once_with(
            {
                "type": "tool_start",
                "ref": self.ref,
                "message": {"tool": "test_tool", "input": "input_value"},
            }
        )

    def test_on_tool_end_search(self):
        # Mock tool output
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = content

        content = [
            {
                "id": 1,
                "title": "Result 1",
                "visibility": "public",
                "work_type": "article",
                "thumbnail": "img1",
            },
            {
                "id": 2,
                "title": "Result 2",
                "visibility": "private",
                "work_type": "document",
                "thumbnail": "img2",
            },
        ]

        output = MockToolMessage("search", content)
        self.handler.on_tool_end(output)

        # Verify search_result message was sent
        expected_message = [
            {
                "id": 1,
                "title": "Result 1",
                "visibility": "public",
                "work_type": "article",
                "thumbnail": "img1",
            },
            {
                "id": 2,
                "title": "Result 2",
                "visibility": "private",
                "work_type": "document",
                "thumbnail": "img2",
            },
        ]

        self.mock_socket.send.assert_called_once_with(
            {"type": "search_result", "ref": self.ref, "message": expected_message}
        )

    def test_on_tool_end_aggregate(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = content

        output = MockToolMessage("aggregate", {"aggregation_result": {"count": 10}})
        self.handler.on_tool_end(output)

        # Verify aggregation_result message was sent
        self.mock_socket.send.assert_called_once_with(
            {"type": "aggregation_result", "ref": self.ref, "message": {"count": 10}}
        )

    def test_on_tool_end_discover_fields(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = content

        output = MockToolMessage("discover_fields", {})
        self.handler.on_tool_end(output)

        self.mock_socket.send.assert_not_called()

    def test_on_tool_end_unknown(self):
        class MockToolMessage:
            def __init__(self, name, content):
                self.name = name
                self.content = content

        output = MockToolMessage("unknown", {})
        self.handler.on_tool_end(output)

        self.mock_socket.send.assert_not_called()

    def test_on_agent_finish(self):
        self.handler.on_agent_finish(finish={})
        self.mock_socket.send.assert_called_once_with(
            {"type": "final", "ref": self.ref, "message": "Finished"}
        )


class TestSocketCallbackHandlerErrors(TestCase):
    def test_missing_socket(self):
        with self.assertRaises(ValueError) as context:
            SocketCallbackHandler(socket=None, ref="abc123")

        self.assertIn(
            "Socket not provided to agent callback handler", str(context.exception)
        )
