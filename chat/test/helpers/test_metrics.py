# ruff: noqa: E402
import json
import os
import sys
sys.path.append('./src')

from unittest import TestCase, mock
from helpers.metrics import count_tokens, token_usage
from event_config import EventConfig 



@mock.patch.dict(
    os.environ,
    {
        "AZURE_OPENAI_RESOURCE_NAME": "test",
        "WEAVIATE_URL": "http://test",
        "WEAVIATE_API_KEY": "test"
    },
)
class TestMetrics(TestCase):
    def test_token_usage(self):
        original_question = {
            "question": "What is your name?",
            "source_documents": [],
        }
        event = {
            "body": json.dumps({
                "deployment_name": "test",
                "index": "test",
                "k": 1,
                "openai_api_version": "2019-05-06",
                "prompt": "This is a test prompt.",
                "question": original_question,
                "ref": "test",
                "temperature": 0.5,
                "text_key": "text",
                "auth": "test123"
            })
        }
        config = EventConfig(event=event)

        response = {
            "output_text": "This is a test response.",
        }

        result = token_usage(config, response, original_question)

        expected_result = {
            "answer": 6,
            "prompt": 36,
            "question": 15,
            "source_documents": 1,
        }

        self.assertEqual(result, expected_result)

    def test_count_tokens(self):
        val = "Hello, world!"
        expected_result = 4

        result = count_tokens(val)

        self.assertEqual(result, expected_result)
