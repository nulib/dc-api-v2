# ruff: noqa: E402
import json
import os
import sys
sys.path.append('./src')

from unittest import TestCase, mock
from helpers.metrics import count_tokens, debug_response, token_usage
from event_config import EventConfig 



class TestMetrics(TestCase):
    @mock.patch.dict(
        os.environ,
        {
            "AZURE_OPENAI_RESOURCE_NAME": "test",
            "WEAVIATE_URL": "http://test",
            "WEAVIATE_API_KEY": "test"
        },
    )
    def setUp(self):
        self.question = "What is your name?"
        self.original_question = {
            "question": self.question,
            "source_documents": self.generate_source_documents(20),
        }
        self.event = {
            "body": json.dumps({
                "deployment_name": "test",
                "index": "test",
                "k": 40,
                "openai_api_version": "2019-05-06",
                "prompt": "This is a test prompt.",
                "question": self.question,
                "ref": "test",
                "size": 5,
                "temperature": 0.5,
                "text_key": "text",
                "auth": "test123"
            })
        }
        self.config = EventConfig(event=self.event)
        self.response = {
            "output_text": "This is a test response.",
        }

    def generate_source_documents(self, count):
        return [
            {
                "accession_number": f"SourceDoc:{i+1}",
                "api_link": f"https://api.dc.library.northwestern.edu/api/v2/works/{i+1:0>32}",
                "canonical_link": f"https://dc.library.northwestern.edu/items/{i+1:0>32}",
                "title": f"Source Document {i+1}!"
            }
            for i in range(count)
        ]
    
    def test_debug_response(self):
        result = debug_response(self.config, self.response, self.original_question)
        
        self.assertEqual(result["k"], 40)
        self.assertEqual(result["question"], self.question)
        self.assertEqual(result["ref"], "test")
        self.assertEqual(result["size"], 20)
        self.assertEqual(len(result["source_documents"]), 20)
        self.assertEqual(
            result["source_documents"],
            [doc["api_link"] for doc in self.original_question["source_documents"]]
        )

    def test_token_usage(self):
        result = token_usage(self.config, self.response, self.original_question)

        expected_result = {
            "answer": 12,
            "prompt": 329,
            "question": 5,
            "source_documents": 1602,
            "total": 1948
        }

        self.assertEqual(result, expected_result)

    def test_count_tokens(self):
        val = "Hello, world!"
        expected_result = 4

        result = count_tokens(val)

        self.assertEqual(result, expected_result)
