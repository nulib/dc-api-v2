import os
from src.helpers.apitoken import ApiToken
from test.fixtures.apitoken import TEST_SECRET, TEST_TOKEN
from unittest import mock, TestCase

@mock.patch.dict(
  os.environ, 
  {
    "API_TOKEN_SECRET": TEST_SECRET
  }
)
class TestFunction(TestCase):
  def test_empty_token(self):
    subject = ApiToken()
    self.assertFalse(subject.is_logged_in())

  def test_valid_token(self):
    subject = ApiToken(TEST_TOKEN)
    self.assertTrue(subject.is_logged_in())

  def test_invalid_token(self):
    subject = ApiToken("INVALID_TOKEN")
    self.assertFalse(subject.is_logged_in())
  