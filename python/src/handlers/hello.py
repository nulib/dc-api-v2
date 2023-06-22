import os

def lambda_handler(event, context):
  params = event.get("queryStringParameters", {})
  name = params.get("name", os.getenv("DEFAULT_NAME", "No One"))
  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": f"Hello, {name}"
  }