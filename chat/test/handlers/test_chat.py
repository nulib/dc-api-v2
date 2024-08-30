# ruff: noqa: E402

import json
import os
import sys

sys.path.append('./src')

from unittest import mock, TestCase
from unittest.mock import patch
from handlers.chat import handler
from helpers.apitoken import ApiToken
from helpers.response import Response
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

# TODO: Find a way to build a better mock response (maybe using helpers.metrics.debug_response)
def mock_response(**kwargs):
  result = {
    'answer': 'Answer.',
    'attributes': ['accession_number', 'alternate_title', 'api_link', 'canonical_link', 'caption', 'collection', 'contributor', 'date_created', 'date_created_edtf', 'description', 'genre', 'id', 'identifier', 'keywords', 'language', 'notes', 'physical_description_material', 'physical_description_size', 'provenance', 'publisher', 'rights_statement', 'subject', 'table_of_contents', 'thumbnail', 'title', 'visibility', 'work_type'],
    'azure_endpoint': 'https://nul-ai-east.openai.azure.com/',
    'deployment_name': 'gpt-4o',
    'is_dev_team': False,
    'is_superuser': False,
    'k': 10,
    'openai_api_version': '2024-02-01',
    'prompt': "Prompt",
    'question': 'Question?',
    'ref': 'ref123',
    'size': 20,
    'source_documents': [], 
    'temperature': 0.2, 
    'text_key': 'id', 
    'token_counts': {'question': 19, 'answer': 348, 'prompt': 329, 'source_documents': 10428,'total': 11124}
  }
  result.update(kwargs)
  return result

@mock.patch.dict(
    os.environ,
    {
        "AZURE_OPENAI_RESOURCE_NAME": "test",
    },
)
@mock.patch.object(Response, "prepare_response", lambda _: mock_response())
class TestHandler(TestCase):
    def test_handler_unauthorized(self):        
        event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test")}
        self.assertEqual(handler(event, MockContext()), {'body': 'Unauthorized', 'statusCode': 401})
    
    @patch.object(ApiToken, 'is_logged_in')
    def test_handler_success(self, mock_is_logged_in):
      mock_is_logged_in.return_value = True
      event = {"socket": Websocket(client=MockClient(), endpoint_url="test", connection_id="test", ref="test"), "body": '{"question": "Question?"}' }
      self.assertEqual(handler(event, MockContext()), {'statusCode': 200})
    
    @patch.object(ApiToken, 'is_logged_in')
    @patch.object(ApiToken, 'is_superuser')
    @patch.object(EventConfig, '_is_debug_mode_enabled')
    def test_handler_debug_mode(self, mock_is_debug_enabled, mock_is_superuser, mock_is_logged_in):
      mock_is_debug_enabled.return_value = True
      mock_is_logged_in.return_value = True
      mock_is_superuser.return_value = True
      mock_client = MockClient()
      mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
      event = {"socket": mock_websocket, "debug": True, "body": '{"question": "Question?"}' }
      handler(event, MockContext())
      response = json.loads(mock_client.received_data)
      expected_keys = {"attributes", "azure_endpoint", "deployment_name"}
      received_keys = response.keys()
      self.assertTrue(expected_keys.issubset(received_keys))
      
    @patch.object(ApiToken, 'is_logged_in')
    @patch.object(ApiToken, 'is_superuser')
    def test_handler_debug_mode_for_superusers_only(self, mock_is_superuser, mock_is_logged_in):
      mock_is_logged_in.return_value = True
      mock_is_superuser.return_value = False
      mock_client = MockClient()
      mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
      event = {"socket": mock_websocket, "body": '{"question": "Question?", "debug": "true"}'}
      handler(event, MockContext())
      response = json.loads(mock_client.received_data)
      expected_keys = {"answer", "ref"}
      received_keys = set(response.keys())
      self.assertSetEqual(received_keys, expected_keys)

    @patch.object(ApiToken, 'is_logged_in')
    def test_handler_question_missing(self, mock_is_logged_in):
        mock_is_logged_in.return_value = True
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket}
        handler(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")

    @patch.object(ApiToken, 'is_logged_in')
    def test_handler_question_blank(self, mock_is_logged_in):
        mock_is_logged_in.return_value = True
        mock_client = MockClient()
        mock_websocket = Websocket(client=mock_client, endpoint_url="test", connection_id="test", ref="test")
        event = {"socket": mock_websocket, "body": '{"quesion": ""}'}
        handler(event, MockContext())
        response = json.loads(mock_client.received_data)
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Question cannot be blank")
