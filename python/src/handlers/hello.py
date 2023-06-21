import os

def lambda_handler(event, context):
  name = event.get("queryStringParameters", {}).get("name", os.getenv("DEFAULT_NAME", "No One"))
  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": f"Hello, {name}"
  }