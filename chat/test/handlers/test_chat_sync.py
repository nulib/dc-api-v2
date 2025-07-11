# ruff: noqa: E402

import json
import pytest
from unittest import TestCase
from unittest.mock import patch
from moto import mock_aws

from handlers import chat_sync
from core.apitoken import ApiToken
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver


class MockContext:
    def __init__(self):
        self.log_stream_name = "test"


@mock_aws
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
class TestHandler(TestCase):
    def test_handler_unauthorized(self):
        self.assertEqual(
            chat_sync({"body": '{ "question": "Question?"}'}, MockContext()),
            {"body": "Unauthorized", "statusCode": 401},
        )

    @patch.object(ApiToken, "is_logged_in", return_value=True)
    @patch.object(ApiToken, "is_dev_team", return_value=False)
    def test_not_dev_team(self, mock_is_logged_in, mock_is_dev_team):
        self.assertEqual(
            chat_sync({"body": '{ "question": "foo"}'}, MockContext()),
            {"statusCode": 401, "body": "Unauthorized"},
        )

    @patch.object(ApiToken, "is_logged_in", return_value=True)
    @patch.object(ApiToken, "is_dev_team", return_value=True)
    def test_no_question(self, mock_is_logged_in, mock_is_dev_team):
        self.assertEqual(
            chat_sync({"body": '{ "question": ""}'}, MockContext()),
            {"statusCode": 400, "body": "Question cannot be blank"},
        )

    @patch.object(ApiToken, "is_logged_in", return_value=True)
    @patch.object(ApiToken, "is_dev_team", return_value=True)
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    @patch(
        "handlers.chat_model",
        return_value=FakeListChatModel(responses=["fake response"]),
    )
    def test_handler_success(
        self, mock_chat_model, mock_create_saver, mock_is_logged_in, mock_is_dev_team
    ):
        expected_body = {
            "answer": ["fake response"],
            "is_dev_team": True,
            "is_superuser": False,
            "k": 40,
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "question": "Question?",
            "ref": "test_ref",
            "artifacts": [],
            "token_counts": {},
        }
        response = chat_sync({"body": '{"question": "Question?", "ref": "test_ref"}'}, MockContext())
        
        self.assertEqual(json.loads(response.get("body")), expected_body)
        self.assertEqual(response.get("statusCode"), 200)
        self.assertEqual(
            response.get("headers", {}).get("Content-Type"), "application/json"
        )

    @patch.object(ApiToken, "is_logged_in", return_value=False)
    @patch.object(ApiToken, "is_superuser", return_value=True)
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    @patch(
        "handlers.chat_model",
        return_value=FakeListChatModel(responses=["fake response"]),
    )
    
    def test_superuser_success(
        self, mock_chat_model, mock_create_saver, mock_is_logged_in, mock_is_superuser
    ):
        expected_body = {
            "answer": ["fake response"],
            "is_superuser": True,
            "is_dev_team": False,
            "k": 40,
            "model": "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "question": "Question?",
            "ref": "test_ref",
            "artifacts": [],
            "token_counts": {},
        }
        response = chat_sync(
            {"body": '{"question": "Question?", "ref": "test_ref"}'}, MockContext()
        )

        self.assertEqual(json.loads(response.get("body")), expected_body)
        self.assertEqual(response.get("statusCode"), 200)
        self.assertEqual(
            response.get("headers", {}).get("Content-Type"), "application/json"
        )
