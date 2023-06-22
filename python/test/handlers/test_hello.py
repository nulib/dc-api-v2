import unittest
from src.handlers import hello

class TestFunction(unittest.TestCase):
  def test_function(self):
    event = {'queryStringParameters': {'name': 'Joe'}}
    context = {'requestid' : '1234'}
    result = hello.lambda_handler(event, context)
    self.assertEqual(result['body'], 'Hello, Joe')
