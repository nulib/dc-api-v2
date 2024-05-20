# ruff: noqa: E402

import contextlib
from io import StringIO
import json
import os
import sys

sys.path.append('./src')

from unittest import mock, TestCase
from unittest.mock import patch
from handlers.chat import handler
from helpers.apitoken import ApiToken
from websocket import Websocket
from event_config import EventConfig

class MockClient:
    def __init__(self):
        self.received_data = None

    def post_to_connection(self, Data, ConnectionId):
        self.received_data = Data
        return Data

class MockContext:
   def __init__(self):
      self.log_stream_name = 'test'

@mock.patch.dict(
    os.environ,
    {
        "AZURE_OPENAI_RESOURCE_NAME": "test",
    },
)
class TestHandler(TestCase):
    def test_handler_unauthorized(self):        
        event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test")}
        self.assertEqual(handler(event, MockContext()), {'body': 'Unauthorized', 'statusCode': 401})
      
    @patch.object(ApiToken, 'is_logged_in')
    def test_handler_success(self, mock_is_logged_in):
      mock_is_logged_in.return_value = True
      event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test")}
      self.assertEqual(handler(event, MockContext()), {'statusCode': 200})
    
    @patch.object(ApiToken, 'is_logged_in')
    @patch.object(ApiToken, 'is_superuser')
    @patch.object(EventConfig, '_is_debug_mode_enabled')
    def test_handler_debug_mode(self, mock_is_debug_enabled, mock_is_logged_in, mock_is_superuser):
      mock_is_debug_enabled.return_value = True
      mock_is_logged_in.return_value = True
      mock_is_superuser.return_value = True
      mock_client = MockClient()
      mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
      event = {"socket": mock_websocket, "debug": True}
      handler(event, MockContext())
      response = json.loads(mock_client.received_data)
      self.assertEqual(response["type"], "debug")
      
    @patch.object(ApiToken, 'is_logged_in')
    @patch.object(ApiToken, 'is_superuser')
    @patch.object(EventConfig, '_is_debug_mode_enabled')
    def test_handler_debug_mode_for_superusers_only(self, mock_is_debug_enabled, mock_is_logged_in, mock_is_superuser):
      mock_is_debug_enabled.return_value = True
      mock_is_logged_in.return_value = True
      mock_is_superuser.return_value = False
      mock_client = MockClient()
      mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
      event = {"socket": mock_websocket, "debug": True}
      handler(event, MockContext())
      response = json.loads(mock_client.received_data)
      self.assertEqual(response["type"], "error")
    
    @patch.object(EventConfig, 'setup_websocket')
    def test_error_handling(self, mock_event):
      mock_event.side_effect = Exception("Some error occurred")
      capture = StringIO()
      with contextlib.redirect_stdout(capture):
        response = handler({}, {})
        self.assertEqual(response['statusCode'], 500)
        self.assertIn('Unhandled error:', response['body'])
        self.assertIn('Exception: Some error occurred', response['body'])
        self.assertIn('Exception: Some error occurred', capture.getvalue())
      
