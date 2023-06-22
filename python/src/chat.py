from langchain.vectorstores import Weaviate
import json
import setup

def handler(event, context):
  params = event.get("queryStringParameters", {})
  query = params.get("query")

  CLIENT = setup.connect()
  index_name = "Work"
  text_key = "title"

  weaviate = Weaviate(CLIENT, index_name, text_key)
  result = weaviate.similarity_search_by_text(query=query, additional="certainty")

  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": json.dumps(result)
  }