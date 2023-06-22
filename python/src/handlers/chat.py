import os
import setup


def handler(event, context):
  setup.connect()
  params = event.get("queryStringParameters", {})
  query = params.get("query")
  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": f"Hello, {query}"
  }