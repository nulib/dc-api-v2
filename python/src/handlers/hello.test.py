import unittest

function = __import__('hello')
handler = function.lambda_handler

class TestFunction(unittest.TestCase):
  def test_function(self):
    event = {'queryStringParameters': {'name': 'Joe'}}
    context = {'requestid' : '1234'}
    result = handler(event, context)
    self.assertEqual(str(result), "{'statusCode': 200, 'headers': {'Content-Type': 'text/plain'}, 'body': 'Hello, Joe'}")

if __name__ == '__main__':
    unittest.main()