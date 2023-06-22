import base64
import json
import setup

def handler(event, context):
  question = event.get("body", "")
  if event.get("isBase64Encoded", False):
    question = base64.b64decode(question)

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