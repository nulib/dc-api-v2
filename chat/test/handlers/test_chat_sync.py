# ruff: noqa: E402

import os
import sys

sys.path.append('./src')

from unittest import mock, TestCase
from unittest.mock import patch
from handlers.chat_sync import handler
from helpers.apitoken import ApiToken

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
        self.assertEqual(handler({"body": '{ "question": "Question?"}'}, MockContext()), {'body': 'Unauthorized', 'statusCode': 401})

    @patch.object(ApiToken, 'is_logged_in')
    def test_no_question(self, mock_is_logged_in):
      mock_is_logged_in.return_value = True
      self.assertEqual(handler({"body": '{ "question": ""}'}, MockContext()), {'statusCode': 400, 'body': 'Question cannot be blank'})
    
    @patch.object(ApiToken, 'is_logged_in')
    def test_handler_success(self, mock_is_logged_in):
      mock_is_logged_in.return_value = True
      self.assertEqual(handler({"body": '{"question": "Question?"}'}, MockContext()), {'statusCode': 200})
