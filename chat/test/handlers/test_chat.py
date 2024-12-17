# ruff: noqa: E402

from unittest import TestCase
from unittest.mock import patch
import json
import sys

sys.path.append('./src')

from handlers.chat import handler
from helpers.apitoken import ApiToken
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver
from websocket import Websocket


class MockClient:
    def __init__(self):
        self.received_data = None

    def post_to_connection(self, Data, ConnectionId):
        self.received_data = Data
        return Data

class MockContext:
    def __init__(self):
        self.log_stream_name = 'test'

class TestHandler(TestCase):

    @patch.object(ApiToken, 'is_logged_in', return_value=False)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_unauthorized(self, mock_create_saver, mock_is_logged_in):
        event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test")}
        self.assertEqual(handler(event, MockContext()), {'statusCode': 401, 'body': 'Unauthorized'})

    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    @patch('handlers.chat.chat_model', return_value=FakeListChatModel(responses=["fake response"]))
    def test_handler_success(self, mock_chat_model, mock_create_saver, mock_is_logged_in):
        event = {
            "socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test"),
            "body": '{"question": "Question?"}'
        }
        self.assertEqual(handler(event, MockContext()), {'statusCode': 200})

    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_question_missing(self, mock_create_saver, mock_is_logged_in):
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket}
        handler(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch.object(ApiToken, 'is_logged_in', return_value=True)
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_handler_question_typo(self, mock_create_saver, mock_is_logged_in):
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket, "body": '{"quesion": ""}'}
        handler(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")