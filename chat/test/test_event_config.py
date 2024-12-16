# ruff: noqa: E402
import json
import os
import sys
sys.path.append('./src')

from event_config import EventConfig
from unittest import TestCase, mock

class TestEventConfig(TestCase):
    def test_defaults(self):
        actual = EventConfig(event={"body": json.dumps({"question": "Question?"})})
        self.assertEqual(actual.question, "Question?")

    def test_attempt_override_without_superuser_status(self):
        actual = EventConfig(
            event={
                "body": json.dumps(
                    {
                        "k": 100,
                        "question": "test question",
                        "ref": "test ref",
                        "size": 90,
                        "temperature": 0.9,
                    }
                )
            }
        )
        expected_output = {
            "k": 40,
            "question": "test question",
            "ref": "test ref",
            "size": 20,
            "temperature": 0.2,
        }
        self.assertEqual(actual.k, expected_output["k"])
        self.assertEqual(actual.question, expected_output["question"])
        self.assertEqual(actual.ref, expected_output["ref"])
        self.assertEqual(actual.size, expected_output["size"])
        self.assertEqual(actual.temperature, expected_output["temperature"])
    