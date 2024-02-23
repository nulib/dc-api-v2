# ruff: noqa: E402
import sys
sys.path.append('./src')

from helpers.prompts import prompt_template, document_template
from unittest import TestCase


class TestPromptTemplate(TestCase):
    def test_prompt_template(self):
        prompt = prompt_template()
        assert isinstance(prompt, str)
        assert len(prompt) > 0


class TestDocumentTemplate(TestCase):
    def test_empty_attributes(self):
        self.assertEqual(
            document_template(),
            "Content: {title}\nMetadata:\nSource: {id}",
        )

    def test_single_attribute(self):
        self.assertEqual(
            document_template(["title"]),
            "Content: {title}\nMetadata:\n  title: {title}\nSource: {id}",
        )

    def test_multiple_attributes(self):
        self.assertEqual(
            document_template(["title", "author", "subject", "description"]),
            "Content: {title}\nMetadata:\n  title: {title}\n  author: {author}\n  subject: {subject}\n  description: {description}\nSource: {id}",
        )
