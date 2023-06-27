import os
from unittest import mock, TestCase

from src.helpers.event import Event
from test.fixtures.apitoken import TEST_TOKEN_NAME, TEST_SECRET
from test.fixtures.events import (
  COOKIE_TOKEN_EVENT, 
  NO_BODY_EVENT, 
  NO_TOKEN_EVENT, 
  PLAIN_BODY_EVENT, 
  POST_EVENT
)

@mock.patch.dict(
  os.environ, 
  {
    "API_TOKEN_NAME": TEST_TOKEN_NAME, 
    "API_TOKEN_SECRET": TEST_SECRET
  }
)
class TestFunction(TestCase):
  def test_method(self):
    subject = Event(POST_EVENT)
    self.assertTrue(subject.is_post_request())
    self.assertFalse(subject.is_get_request())
    self.assertFalse(subject.is_head_request())
    self.assertFalse(subject.is_options_request())

  def test_body_base64(self):
    subject = Event(POST_EVENT)
    self.assertEqual(subject.body(), "POSTed Content")
  
  def test_body_plain(self):
    subject = Event(PLAIN_BODY_EVENT)
    self.assertEqual(subject.body(), "POSTed Content")

  def test_body_empty(self):
    subject = Event(NO_BODY_EVENT)
    self.assertIsNone(subject.body())

  def test_cookie(self):
    subject = Event(POST_EVENT)
    self.assertEqual(subject.cookie("cookie_1"), "cookie_value_1")
    self.assertEqual(subject.cookie("cookie_2"), "cookie_value_2")
    self.assertIsNone(subject.cookie("cookie_3"))

  def test_param(self):
    subject = Event(POST_EVENT)
    self.assertEqual(subject.param("param1"), "value1")
    self.assertEqual(subject.param("param2"), "value2")
    self.assertIsNone(subject.param("param3"))

  def test_bearer_auth(self):
    subject = Event(POST_EVENT)
    self.assertTrue(subject.api_token.is_logged_in())

  def test_cookie_auth(self):
    subject = Event(COOKIE_TOKEN_EVENT)
    self.assertTrue(subject.api_token.is_logged_in())

  def test_unauthorized(self):
    subject = Event(NO_TOKEN_EVENT)
    self.assertFalse(subject.api_token.is_logged_in())
