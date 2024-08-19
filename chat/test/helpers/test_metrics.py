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
            "source_documents": [
                {
                    "accession_number": "SourceDoc:1",
                    "api_link": "https://api.dc.library.northwestern.edu/api/v2/works/881e8cae-67be-4e04-9970-7eafb52b2c5c",
                    "canonical_link": "https://dc.library.northwestern.edu/items/881e8cae-67be-4e04-9970-7eafb52b2c5c",
                    "title": "Source Document One!"
                },
                {
                    "accession_number": "SourceDoc:2",
                    "api_link": "https://api.dc.library.northwestern.edu/api/v2/works/ac0b2a0d-8f80-420a-b1a1-63b6ac2299f1",
                    "canonical_link": "https://dc.library.northwestern.edu/items/ac0b2a0d-8f80-420a-b1a1-63b6ac2299f1",
                    "title": "Source Document Two!"
                },
                {
                    "accession_number": "SourceDoc:3",
                    "api_link": "https://api.dc.library.northwestern.edu/api/v2/works/11569bb5-1b89-4fa9-bdfb-2caf2ded5aa5",
                    "canonical_link": "https://dc.library.northwestern.edu/items/11569bb5-1b89-4fa9-bdfb-2caf2ded5aa5",
                    "title": "Source Document Three!"
                },
                {
                    "accession_number": "SourceDoc:4",
                    "api_link": "https://api.dc.library.northwestern.edu/api/v2/works/211eeeca-d56e-4c6e-9123-1612d72258f9",
                    "canonical_link": "https://dc.library.northwestern.edu/items/211eeeca-d56e-4c6e-9123-1612d72258f9",
                    "title": "Source Document Four!"
                },
                {
                    "accession_number": "SourceDoc:5",
                    "api_link": "https://api.dc.library.northwestern.edu/api/v2/works/10e45e7a-8011-4ac5-97df-efa6a5439d0e",
                    "canonical_link": "https://dc.library.northwestern.edu/items/10e45e7a-8011-4ac5-97df-efa6a5439d0e",
                    "title": "Source Document Five!"
                }
            ],
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
    
    def test_debug_response(self):
        result = debug_response(self.config, self.response, self.original_question)
        
        self.assertEqual(result["k"], 40)
        self.assertEqual(result["question"], self.question)
        self.assertEqual(result["ref"], "test")
        self.assertEqual(result["size"], 5)
        self.assertEqual(
            result["source_documents"],
            [
                "https://api.dc.library.northwestern.edu/api/v2/works/881e8cae-67be-4e04-9970-7eafb52b2c5c",
                "https://api.dc.library.northwestern.edu/api/v2/works/ac0b2a0d-8f80-420a-b1a1-63b6ac2299f1",
                "https://api.dc.library.northwestern.edu/api/v2/works/11569bb5-1b89-4fa9-bdfb-2caf2ded5aa5",
                "https://api.dc.library.northwestern.edu/api/v2/works/211eeeca-d56e-4c6e-9123-1612d72258f9",
                "https://api.dc.library.northwestern.edu/api/v2/works/10e45e7a-8011-4ac5-97df-efa6a5439d0e"
            ]
        )

    def test_token_usage(self):
        result = token_usage(self.config, self.response, self.original_question)

        expected_result = {
            "answer": 12,
            "prompt": 322,
            "question": 5,
            "source_documents": 527,
            "total": 866
        }

        self.assertEqual(result, expected_result)

    def test_count_tokens(self):
        val = "Hello, world!"
        expected_result = 4

        result = count_tokens(val)

        self.assertEqual(result, expected_result)
