import base64
import json
import os
import setup

def handler(event, context):
  question = event.get("body", "")
  if event.get("isBase64Encoded", False):
    question = base64.b64decode(question)

  headers = event.get("headers")
  token = headers.get("authorization", headers.get("Authorization", None))
  print(f"TOKEN: {token}")
  if token == None:
    for cookie in event.get("cookies", []):
      print(f"HAVE A COOKIE: {cookie}")
      [k, v] = cookie.split("=", 1)
      if k == os.getenv("API_TOKEN_NAME"):
        token = v
  else:
    token = token.replace("Bearer ", "")

  if not setup.validate_token(token):
    return {
    "statusCode": 401,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": "Unauthorized"
  }


  params = event.get("queryStringParameters", {})
  index_name = params.get("index", "Work")
  text_key = params.get("text_key", "title")
  attributes = params.get("attributes", "identifier,title").split(",")

  weaviate = setup.weaviate_vector_store(index_name=index_name, text_key=text_key, attributes=attributes)
  result = weaviate.similarity_search_by_text(query=question, additional="certainty")

  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": json.dumps([doc.__dict__ for doc in result])
  }