# ruff: noqa: E402

import boto3
import json
import os
import pytest
from unittest import TestCase
from unittest.mock import patch
from moto import mock_aws

from handlers import chat
from core.apitoken import ApiToken
from core.websocket import Websocket
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver
from test.fixtures.apitoken import TEST_SECRET, TEST_TOKEN

class MockClient:
    def __init__(self):
        self.received_data = None

    def post_to_connection(self, Data, ConnectionId):
        self.received_data = Data
        return Data

class MockContext:
    def __init__(self):
        self.log_stream_name = 'test_log_stream'

@mock_aws
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
class TestHandler(TestCase):

    @patch.object(ApiToken, 'is_logged_in', return_value=False)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_unauthorized(self, mock_create_saver, mock_is_logged_in):
        event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test")}
        self.assertEqual(chat(event, MockContext()), {'statusCode': 401, 'body': 'Unauthorized'})

    @patch.dict(os.environ, {"API_TOKEN_SECRET": TEST_SECRET})
    @patch.object(ApiToken, "can", return_value=True)
    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    @patch('handlers.chat_model', return_value=FakeListChatModel(responses=["fake response"]))
    def test_handler_success(self, mock_chat_model, mock_create_saver, mock_is_logged_in, mock_can):
        event = {
            "socket": Websocket(
                client=MockClient(),
                endpoint_url="test",
                connection_id="test",
                ref="test",
            ),
            "body": '{"question": "Question?", "auth": "%s"}' % TEST_TOKEN,
        }
        response = chat(event, MockContext())
        self.assertEqual(response, {'statusCode': 200})
        mock_can.assert_called_once_with("chat")

    @patch.object(ApiToken, 'can', return_value=True)
    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_question_missing(self, mock_create_saver, mock_is_logged_in, mock_can):
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket}
        chat(event, MockContext())
        mock_can.assert_called_once_with("chat")
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch.object(ApiToken, "can", return_value=True)
    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_question_typo(self, mock_create_saver, mock_is_logged_in, mock_can):
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket, "body": '{"quesion": ""}'}
        chat(event, MockContext())
        mock_can.assert_called_once_with("chat")
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch.dict(os.environ, {"API_TOKEN_SECRET": TEST_SECRET})
    @patch.dict(os.environ, {"METRICS_LOG_GROUP": "/nul/test/metrics/log/group"})
    @patch.object(ApiToken, "can", return_value=True)
    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    @patch('handlers.chat_model', return_value=FakeListChatModel(responses=["fake response"]))
    def test_handler_with_metrics(self, mock_model, mock_create_saver, mock_is_logged_in, mock_can):
        client = boto3.client("logs", region_name="us-east-1")
        client.create_log_group(logGroupName=os.getenv("METRICS_LOG_GROUP"))
        
        event = {
            "socket": Websocket(
                client=MockClient(),
                endpoint_url="test",
                connection_id="test",
                ref="test",
            ),
            "body": '{"question": "Question?", "ref": "test", "auth": "%s"}' % TEST_TOKEN,
        }
        chat(event, MockContext())
        chat(event, MockContext()) # Second call to test if log stream already exists

        response = client.get_log_events(
            logGroupName="/nul/test/metrics/log/group",
            logStreamName="test_log_stream"
        )
        expected = {
            "answer": ["fake response"],
            "artifacts": [],
            "user": {
                "auth_provider": "test",
                "is_dev_team": False,
                "is_superuser": False,
            },
            "k": 40,
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "question": "Question?",
            "ref": "test",
            "token_counts": {}
        }
        log_events = response["events"]
        self.assertEqual(len(log_events), 2)
        self.assertEqual(json.loads(log_events[0]["message"]), expected)
