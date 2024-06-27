# ruff: noqa: E402
import sys
sys.path.append('./src')

from unittest import TestCase
from handlers.streaming_socket_callback_handler import (
    StreamingSocketCallbackHandler,
)
from websocket import Websocket
from langchain_core.outputs.llm_result import LLMResult
from langchain_core.outputs import ChatGeneration
from langchain_core.messages.ai import AIMessage


class MockClient:
    def post_to_connection(self, Data, ConnectionId):
        return Data

class TestMyStreamingSocketCallbackHandler(TestCase):
    def test_on_new_llm_token(self):
        handler = StreamingSocketCallbackHandler(Websocket(client=MockClient()))
        result = handler.on_llm_new_token(token="test")
        self.assertEqual(result, {'token': 'test', 'ref': {}})
        self.assertTrue(handler.stream)

    def test_on_llm_end(self):
        handler = StreamingSocketCallbackHandler(Websocket(client=MockClient()))
        payload = LLMResult(
            generations=[[
                ChatGeneration(
                    text='LLM Response', 
                    generation_info={'finish_reason': 'stop', 'model_name': 'llm-model', 'system_fingerprint': 'fp_012345678'}, 
                    message=AIMessage(
                        content='LLM Response', 
                        response_metadata={'finish_reason': 'stop', 'model_name': 'llm-model', 'system_fingerprint': 'fp_012345678'}, 
                        id='run-5da4fbbc-b663-4851-809d-fd11c27c5b76-0'
                    )
                )
            ]],
            llm_output=None,
            run=None
        )
        result = handler.on_llm_end(payload)
        self.assertEqual(result, {'end': {'reason': 'stop'}, 'ref': {}})
        self.assertTrue(handler.stream)
        
    def test_debug_mode(self):
        handler = StreamingSocketCallbackHandler(Websocket(client=MockClient()), stream=False)
        self.assertFalse(handler.stream)
