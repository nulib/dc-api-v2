# ruff: noqa: E402
import os

from core.apitoken import ApiToken
from test.fixtures.apitoken import DEV_TEAM_TOKEN, SUPER_TOKEN, TEST_SECRET, TEST_TOKEN
from unittest import mock, TestCase



@mock.patch.dict(os.environ, {"DEV_TEAM_NET_IDS": "abc123"})
@mock.patch.dict(os.environ, {"API_TOKEN_SECRET": TEST_SECRET})
class TestFunction(TestCase):
    def test_empty_token(self):
        subject = ApiToken()
        self.assertIsInstance(subject, ApiToken)
        self.assertFalse(subject.is_logged_in())
        self.assertFalse(subject.is_institution())

    def test_valid_token(self):
        subject = ApiToken(TEST_TOKEN)
        self.assertIsInstance(subject, ApiToken)
        self.assertTrue(subject.is_logged_in())
        self.assertFalse(subject.is_superuser())
        self.assertFalse(subject.is_institution())

    def test_superuser_token(self):
        subject = ApiToken(SUPER_TOKEN)
        self.assertIsInstance(subject, ApiToken)
        self.assertTrue(subject.is_logged_in())
        self.assertTrue(subject.is_superuser())
        self.assertTrue(subject.is_institution())

    def test_devteam_token(self):
        subject = ApiToken(DEV_TEAM_TOKEN)
        self.assertIsInstance(subject, ApiToken)
        self.assertTrue(subject.is_dev_team())
        self.assertTrue(subject.is_institution())

    def test_invalid_token(self):
        subject = ApiToken("INVALID_TOKEN")
        self.assertIsInstance(subject, ApiToken)
        self.assertFalse(subject.is_logged_in())
        self.assertFalse(subject.is_institution())

    def test_empty_token_class_method(self):
        empty_token = ApiToken.empty_token()
        self.assertIsInstance(empty_token, dict)
        self.assertFalse(empty_token["isLoggedIn"])

    def test_str_method(self):
        subject = ApiToken(TEST_TOKEN)
        self.assertEqual(str(subject), f"ApiToken(token={subject.token})")
