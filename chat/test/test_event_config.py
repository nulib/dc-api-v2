# ruff: noqa: E402
import json
import os
import sys
sys.path.append('./src')

from event_config import EventConfig
from unittest import TestCase, mock


@mock.patch.dict(
    os.environ,
    {
        "AI_MODEL_ID": "test",
    },
)
class TestEventConfig(TestCase):
    def test_attempt_override_without_superuser_status(self):
        actual = EventConfig(
            event={
                "body": json.dumps(
                    {
                        "attributes": ["title", "subject", "date_created"],
                        "index": "testIndex",
                        "k": 100,
                        "model_id": "model_override",
                        "question": "test question",
                        "ref": "test ref",
                        "temperature": 0.9,
                        "text_key": "accession_number",
                    }
                )
            }
        )
        expected_output = {
            "attributes": EventConfig.DEFAULT_ATTRIBUTES,
            "model_id": "test",
            "k": 5,
            "question": "test question",
            "ref": "test ref",
            "temperature": 0.2,
            "text_key": "id",
        }
        self.assertEqual(actual.attributes, expected_output["attributes"])
        self.assertEqual(actual.k, expected_output["k"])
        self.assertEqual(actual.question, expected_output["question"])
        self.assertEqual(actual.ref, expected_output["ref"])
        self.assertEqual(actual.temperature, expected_output["temperature"])
        self.assertEqual(actual.text_key, expected_output["text_key"])

    def test_debug_message(self):
        self.assertEqual(
            EventConfig(
                event={"body": json.dumps({"attributes": ["source"]})}
            ).debug_message()["type"],
            "debug",
        )
    
    def test_to_bool(self):
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool(""), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("0"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("no"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("false"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("False"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("FALSE"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("no"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("No"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("NO"), False)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool("true"), True)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool(True), True)
        self.assertEqual(EventConfig(event={"body": json.dumps({"attributes": ["source"]})})._to_bool(False), False)
