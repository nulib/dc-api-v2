# ruff: noqa: E402

import boto3
import json
import os
import pytest
from unittest import TestCase
from unittest.mock import patch, MagicMock
from moto import mock_aws

from handlers import chat
from core.websocket import Websocket
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver


class MockClient:
    def __init__(self):
        self.received_data = None

    def post_to_connection(self, Data, ConnectionId):
        self.received_data = Data
        return Data


class MockContext:
    def __init__(self):
        self.log_stream_name = "test_log_stream"


class MockApiToken:
    def __init__(self, logged_in=True, sub="test-user-123"):
        self.token = {
            "sub": sub,
            "isLoggedIn": logged_in,
            "isDevTeam": False,
            "isSuperUser": False,
            "provider": "none",
        }

    def is_logged_in(self):
        return self.token.get("isLoggedIn", False)

    def is_superuser(self):
        return self.token.get("isSuperUser", False)

    def is_dev_team(self):
        return self.token.get("isDevTeam", False)


@mock_aws
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
class TestHandler(TestCase):
    @patch("handlers.EventConfig")
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    def test_handler_unauthorized(self, mock_create_saver, mock_event_config):
        # Configure the mock to simulate unauthorized user
        mock_config = MagicMock()
        mock_config.is_logged_in = False
        mock_config.is_superuser = False
        mock_config.api_token = MockApiToken(logged_in=False, sub=None)
        mock_event_config.return_value = mock_config

        event = {
            "socket": Websocket(
                client=MockClient(),
                endpoint_url="test",
                connection_id="test",
                ref="test",
            )
        }
        self.assertEqual(
            chat(event, MockContext()), {"statusCode": 401, "body": "Unauthorized"}
        )

    @patch("handlers.EventConfig")
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    @patch(
        "handlers.chat_model",
        return_value=FakeListChatModel(responses=["fake response"]),
    )
    def test_handler_success(
        self, mock_chat_model, mock_create_saver, mock_event_config
    ):
        # Configure the mock to simulate authorized user
        mock_config = MagicMock()
        mock_config.is_logged_in = True
        mock_config.is_superuser = False
        mock_config.api_token = MockApiToken(logged_in=True)
        mock_config.question = "Question?"
        mock_config.stream_response = False
        mock_config.forget = False
        mock_config.docs = None
        mock_config.ref = "test"
        mock_config.k = 40
        mock_config.model = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        mock_event_config.return_value = mock_config

        event = {
            "socket": Websocket(
                client=MockClient(),
                endpoint_url="test",
                connection_id="test",
                ref="test",
            ),
            "body": '{"question": "Question?"}',
        }
        self.assertEqual(chat(event, MockContext()), {"statusCode": 200})

    @patch("handlers.EventConfig")
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    def test_handler_question_missing(self, mock_create_saver, mock_event_config):
        mock_client = MockClient()
        mock_websocket = Websocket(
            client=mock_client, endpoint_url="test", connection_id="test", ref="test"
        )

        # Configure the mock
        mock_config = MagicMock()
        mock_config.is_logged_in = True
        mock_config.is_superuser = False
        mock_config.api_token = MockApiToken()
        mock_config.socket = mock_websocket
        mock_config.question = None
        mock_event_config.return_value = mock_config

        event = {"socket": mock_websocket}
        chat(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch("handlers.EventConfig")
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    def test_handler_question_typo(self, mock_create_saver, mock_event_config):
        mock_client = MockClient()
        mock_websocket = Websocket(
            client=mock_client, endpoint_url="test", connection_id="test", ref="test"
        )

        # Configure the mock
        mock_config = MagicMock()
        mock_config.is_logged_in = True
        mock_config.is_superuser = False
        mock_config.api_token = MockApiToken()
        mock_config.socket = mock_websocket
        mock_config.question = ""
        mock_event_config.return_value = mock_config

        event = {"socket": mock_websocket, "body": '{"quesion": ""}'}
        chat(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch.dict(os.environ, {"METRICS_LOG_GROUP": "/nul/test/metrics/log/group"})
    @patch("handlers.EventConfig")
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    @patch(
        "handlers.chat_model",
        return_value=FakeListChatModel(responses=["fake response"]),
    )
    def test_handler_with_metrics(
        self, mock_model, mock_create_saver, mock_event_config
    ):
        client = boto3.client("logs", region_name="us-east-1")
        client.create_log_group(logGroupName=os.getenv("METRICS_LOG_GROUP"))

        # Configure the mock
        mock_config = MagicMock()
        mock_config.is_logged_in = True
        mock_config.is_superuser = False
        mock_config.api_token = MockApiToken()
        mock_config.question = "Question?"
        mock_config.stream_response = False
        mock_config.forget = False
        mock_config.docs = None
        mock_config.ref = "test"
        mock_config.k = 40
        mock_config.model = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        mock_event_config.return_value = mock_config

        event = {
            "socket": Websocket(
                client=MockClient(),
                endpoint_url="test",
                connection_id="test",
                ref="test",
            ),
            "body": '{"question": "Question?", "ref": "test"}',
        }
        chat(event, MockContext())
        chat(event, MockContext())  # Second call to test if log stream already exists

        response = client.get_log_events(
            logGroupName="/nul/test/metrics/log/group", logStreamName="test_log_stream"
        )
        expected = {
            "answer": ["fake response"],
            "artifacts": [],
            "user": {
                "auth_provider": "none",
                "is_dev_team": False,
                "is_superuser": False,
            },
            "k": 40,
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "question": "Question?",
            "ref": "test",
            "token_counts": {},
        }
        log_events = response["events"]
        self.assertEqual(len(log_events), 2)
        self.assertEqual(json.loads(log_events[0]["message"]), expected)
