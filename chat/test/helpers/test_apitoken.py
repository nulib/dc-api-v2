# ruff: noqa: E402
import os
import sys
sys.path.append('./src')

from helpers.apitoken import ApiToken
from test.fixtures.apitoken import SUPER_TOKEN, TEST_SECRET, TEST_TOKEN
from unittest import mock, TestCase




@mock.patch.dict(os.environ, {"API_TOKEN_SECRET": TEST_SECRET})
class TestFunction(TestCase):
    def test_empty_token(self):
        subject = ApiToken()
        self.assertIsInstance(subject, ApiToken)
        self.assertFalse(subject.is_logged_in())

    def test_valid_token(self):
        subject = ApiToken(TEST_TOKEN)
        self.assertIsInstance(subject, ApiToken)
        self.assertTrue(subject.is_logged_in())
        self.assertFalse(subject.is_superuser())

    def test_superuser_token(self):
        subject = ApiToken(SUPER_TOKEN)
        self.assertIsInstance(subject, ApiToken)
        self.assertTrue(subject.is_logged_in())
        self.assertTrue(subject.is_superuser())

    def test_invalid_token(self):
        subject = ApiToken("INVALID_TOKEN")
        self.assertIsInstance(subject, ApiToken)
        self.assertFalse(subject.is_logged_in())

    def test_empty_token_class_method(self):
        empty_token = ApiToken.empty_token()
        self.assertIsInstance(empty_token, dict)
        self.assertFalse(empty_token["isLoggedIn"])

    def test_str_method(self):
        subject = ApiToken(TEST_TOKEN)
        self.assertEqual(str(subject), f"ApiToken(token={subject.token})")
