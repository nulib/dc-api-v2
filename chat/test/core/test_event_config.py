# ruff: noqa: E402
import json
import unittest
from unittest import TestCase
from unittest.mock import MagicMock, patch

from core.apitoken import ApiToken
from core.event_config import EventConfig
from core.websocket import Websocket


class TestEventConfig(TestCase):
    def test_defaults(self):
        actual = EventConfig(event={"body": json.dumps({"question": "Question?"})})
        self.assertEqual(actual.question, "Question?")

    def test_attempt_override_without_superuser_status(self):
        actual = EventConfig(
            event={
                "body": json.dumps(
                    {
                        "k": 100,
                        "question": "test question",
                        "ref": "test ref",
                        "size": 90,
                        "temperature": 0.9,
                    }
                )
            }
        )
        expected_output = {
            "k": 40,
            "question": "test question",
            "ref": "test ref",
            "size": 20,
            "temperature": 0.2,
        }
        self.assertEqual(actual.k, expected_output["k"])
        self.assertEqual(actual.question, expected_output["question"])
        self.assertEqual(actual.ref, expected_output["ref"])
        self.assertEqual(actual.size, expected_output["size"])
        self.assertEqual(actual.temperature, expected_output["temperature"])


class TestEventConfigSuperuser(unittest.TestCase):
    def setUp(self):
        self.event = {
            "body": json.dumps(
                {
                    "auth": "some_superuser_token",
                    "model": "custom-superuser-model",
                    "prompt": "Custom superuser prompt",
                    "k": 80,
                    "size": 50,
                    "temperature": 0.7,
                    "text_key": "custom_text_key",
                }
            ),
            "requestContext": {
                "connectionId": "test_connection_id",
                "domainName": "example.com",
                "stage": "dev",
            },
        }

    @patch.object(ApiToken, "is_superuser", return_value=True)
    def test_superuser_overrides(self, mock_superuser):
        """
        Test that when the user is a superuser, the payload values override the defaults.
        """
        config = EventConfig(event=self.event)
        self.assertTrue(config.is_superuser)
        # As a superuser, these should reflect the payload values rather than defaults
        self.assertEqual(config.model, "custom-superuser-model")
        self.assertEqual(config.k, 80)  # should not be clipped since 80 < MAX_K (100)
        self.assertEqual(config.size, 50)
        self.assertEqual(config.temperature, 0.7)
        self.assertEqual(config.text_key, "custom_text_key")
        self.assertEqual(config.prompt_text, "Custom superuser prompt")


class TestEventConfigWebsocket(unittest.TestCase):
    def setUp(self):
        self.event = {
            "body": json.dumps(
                {
                    "auth": "some_superuser_token",
                    "model": "custom-superuser-model",
                    "prompt": "Custom superuser prompt",
                    "k": 80,
                    "size": 50,
                    "temperature": 0.7,
                    "text_key": "custom_text_key",
                }
            ),
            "requestContext": {
                "connectionId": "test_connection_id",
                "domainName": "example.com",
                "stage": "dev",
            },
        }

    @patch.object(ApiToken, "is_superuser", return_value=True)
    @patch("core.event_config.Websocket", autospec=True)
    def test_setup_websocket_without_socket(self, mock_websocket_class, mock_superuser):
        config = EventConfig(event=self.event)
        returned_socket = config.setup_websocket()

        mock_websocket_class.assert_called_once_with(
            endpoint_url="https://example.com/dev",
            connection_id="test_connection_id",
            ref=config.ref,
        )

        # Instead of assertIsInstance(returned_socket, mock_websocket_class),
        # we check that it's the return_value of the mock:
        self.assertIs(returned_socket, mock_websocket_class.return_value)
        self.assertEqual(config.socket, mock_websocket_class.return_value)

    @patch.object(ApiToken, "is_superuser", return_value=True)
    def test_setup_websocket_with_existing_socket(self, mock_superuser):
        """
        Test that setup_websocket uses the provided socket if one is passed in.
        """
        config = EventConfig(event=self.event)
        mock_socket = MagicMock(spec=Websocket)
        returned_socket = config.setup_websocket(socket=mock_socket)
        self.assertEqual(returned_socket, mock_socket)
        self.assertEqual(config.socket, mock_socket)
        
class TestEventConfigScope(unittest.TestCase):
    def setUp(self):
        self.event = {
            "body": json.dumps({
                "auth": "some_token",
                "question": "What is the capital of France?"
            })
        }
        self.config = EventConfig(event=self.event)

    @patch.object(ApiToken, 'can', return_value=True)
    def test_can_method(self, mock_can):
        self.assertTrue(self.config.user_can("chat"))
        mock_can.assert_called_once_with("chat")

    @patch.object(ApiToken, 'can', return_value=False)
    def test_can_method_false(self, mock_can):
        self.assertFalse(self.config.user_can("chat"))
        mock_can.assert_called_once_with("chat")
