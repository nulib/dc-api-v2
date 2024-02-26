# ruff: noqa: E402
import json
import os
import sys
sys.path.append('./src')

from event_config import EventConfig
from unittest import TestCase, mock


class TestEventConfigWithoutAzureResource(TestCase):
    def test_requires_an_azure_resource(self):
        with self.assertRaises(EnvironmentError):
            EventConfig()


@mock.patch.dict(
    os.environ,
    {
        "AZURE_OPENAI_RESOURCE_NAME": "test",
    },
)
class TestEventConfig(TestCase):
    def test_fetches_attributes_from_vector_database(self):
        os.environ.pop("AZURE_OPENAI_RESOURCE_NAME", None)
        with self.assertRaises(EnvironmentError):
            EventConfig()

    def test_defaults(self):
        actual = EventConfig(event={"body": json.dumps({"attributes": ["title"]})})
        expected_defaults = {"azure_endpoint": "https://test.openai.azure.com/"}
        self.assertEqual(actual.azure_endpoint, expected_defaults["azure_endpoint"])

    def test_attempt_override_without_superuser_status(self):
        actual = EventConfig(
            event={
                "body": json.dumps(
                    {
                        "azure_resource_name": "new_name_for_test",
                        "attributes": ["title", "subject", "date_created"],
                        "index": "testIndex",
                        "k": 100,
                        "openai_api_version": "2024-01-01",
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
            "azure_endpoint": "https://test.openai.azure.com/",
            "k": 5,
            "openai_api_version": "2023-07-01-preview",
            "question": "test question",
            "ref": "test ref",
            "temperature": 0.2,
            "text_key": "title",
        }
        self.assertEqual(actual.azure_endpoint, expected_output["azure_endpoint"])
        self.assertEqual(actual.attributes, expected_output["attributes"])
        self.assertEqual(actual.k, expected_output["k"])
        self.assertEqual(
            actual.openai_api_version, expected_output["openai_api_version"]
        )
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
