# ruff: noqa: E402
import sys
import json

sys.path.append("./src")

from unittest import TestCase, mock
from core.websocket import Websocket


class MockClient:
    def post_to_connection(self, Data, ConnectionId):
        return Data


class TestWebsocket(TestCase):
    def setUp(self):
        self.mock_client = MockClient()
        self.test_connection_id = "test_connection_id"
        self.test_ref = {"key": "value"}

    def test_init_with_all_parameters(self):
        websocket = Websocket(
            client=self.mock_client,
            endpoint_url="wss://test.com",
            connection_id=self.test_connection_id,
            ref=self.test_ref,
        )
        self.assertEqual(websocket.client, self.mock_client)
        self.assertEqual(websocket.connection_id, self.test_connection_id)
        self.assertEqual(websocket.ref, self.test_ref)

    def test_init_with_minimal_parameters(self):
        with mock.patch("core.websocket.websocket_client") as mock_client_func:
            mock_client_func.return_value = self.mock_client
            websocket = Websocket(endpoint_url="wss://test.com")
            self.assertEqual(websocket.client, self.mock_client)
            self.assertEqual(websocket.connection_id, None)
            self.assertEqual(websocket.ref, {})

    def test_send_string_message(self):
        websocket = Websocket(
            client=self.mock_client,
            connection_id=self.test_connection_id,
            ref=self.test_ref,
        )
        message = "test_message"
        expected = {"message": "test_message", "ref": self.test_ref}
        self.assertEqual(websocket.send(message), expected)

    def test_send_dict_message(self):
        websocket = Websocket(
            client=self.mock_client,
            connection_id=self.test_connection_id,
            ref=self.test_ref,
        )
        message = {"data": "test_data"}
        expected = {"data": "test_data", "ref": self.test_ref}
        self.assertEqual(websocket.send(message), expected)

    def test_send_in_debug_mode(self):
        websocket = Websocket(
            client=self.mock_client, connection_id="debug", ref=self.test_ref
        )
        message = "test_message"
        expected = {"message": "test_message", "ref": self.test_ref}

        # Capture printed output
        with mock.patch("builtins.print") as mock_print:
            result = websocket.send(message)
            mock_print.assert_called_once_with(expected)
            self.assertEqual(result, expected)

    def test_string_representation(self):
        websocket = Websocket(
            client=self.mock_client,
            connection_id=self.test_connection_id,
            ref=self.test_ref,
        )
        expected_str = f"Websocket({self.test_connection_id}, {self.test_ref})"
        self.assertEqual(str(websocket), expected_str)
        self.assertEqual(repr(websocket), expected_str)

    def test_send_converts_to_bytes(self):
        websocket = Websocket(
            client=self.mock_client,
            connection_id=self.test_connection_id,
            ref=self.test_ref,
        )
        message = "test_message"
        expected_bytes = bytes(
            json.dumps({"message": "test_message", "ref": self.test_ref}), "utf-8"
        )

        with mock.patch.object(self.mock_client, "post_to_connection") as mock_post:
            websocket.send(message)
            mock_post.assert_called_once_with(
                Data=expected_bytes, ConnectionId=self.test_connection_id
            )
