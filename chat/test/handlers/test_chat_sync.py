# ruff: noqa: E402

import json
import sys
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver

sys.path.append('./src')

from unittest import TestCase
from unittest.mock import patch
from handlers import chat_sync
from core.apitoken import ApiToken

class MockContext:
   def __init__(self):
      self.log_stream_name = 'test'

class TestHandler(TestCase):
    def test_handler_unauthorized(self):        
        self.assertEqual(chat_sync({"body": '{ "question": "Question?"}'}, MockContext()), {'body': 'Unauthorized', 'statusCode': 401})

    @patch.object(ApiToken, 'is_logged_in', return_value = True)
    def test_no_question(self, mock_is_logged_in):
      self.assertEqual(chat_sync({"body": '{ "question": ""}'}, MockContext()), {'statusCode': 400, 'body': 'Question cannot be blank'})
    
    @patch.object(ApiToken, 'is_logged_in', return_value = True)
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    @patch('handlers.chat_model', return_value=FakeListChatModel(responses=["fake response"]))
    def test_handler_success(self, mock_chat_model, mock_create_saver, mock_is_logged_in):
        expected_body = {
            "answer": ["fake response"], 
            "is_dev_team": False, 
            "is_superuser": False, 
            "k": 40, 
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0", 
            "question": "Question?", 
            "ref": "test_ref", 
            "artifacts": [], 
            "token_counts": {}
        }
        response = chat_sync({"body": '{"question": "Question?", "ref": "test_ref"}'}, MockContext())
        
        self.assertEqual(json.loads(response.get("body")), expected_body)
        self.assertEqual(response.get("statusCode"), 200)
        self.assertEqual(response.get("headers", {}).get("Content-Type"), "application/json")
