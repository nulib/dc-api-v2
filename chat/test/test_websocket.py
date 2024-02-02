# ruff: noqa: E402
import sys
sys.path.append('./src')

from unittest import TestCase
from websocket import Websocket


class MockClient:
    def post_to_connection(self, Data, ConnectionId):
        return Data

class TestWebsocket(TestCase):
    def test_post_to_connection(self):
        websocket = Websocket(client=MockClient(), connection_id="test_connection_id", ref="test_ref")
        message = "test_message"
        expected = {"message": "test_message", "ref": "test_ref"}
        self.assertEqual(websocket.send(message), expected)