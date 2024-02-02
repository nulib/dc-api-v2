# ruff: noqa: E402
import sys
sys.path.append('./src')

from unittest import TestCase
from handlers.streaming_socket_callback_handler import (
    StreamingSocketCallbackHandler,
)
from websocket import Websocket



class MockClient:
    def post_to_connection(self, Data, ConnectionId):
        return Data

class TestMyStreamingSocketCallbackHandler(TestCase):
    def test_on_new_llm_token(self):
        handler = StreamingSocketCallbackHandler(Websocket(client=MockClient()), False)
        result = handler.on_llm_new_token(token="test")
        self.assertEqual(result, {'token': 'test', 'ref': {}})
        self.assertFalse(handler.debug_mode)

    def test_debug_mode(self):
        handler = StreamingSocketCallbackHandler(Websocket(client=MockClient()), debug_mode=True)
        self.assertTrue(handler.debug_mode)
