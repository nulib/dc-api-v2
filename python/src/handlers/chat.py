import base64
import json
import os
import setup
from langchain.chains import RetrievalQAWithSourcesChain




def handler(event, context):
  if not is_authenticated(event):
    return {
    "statusCode": 401,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": "Unauthorized"
  }
  question = get_query(event)
  index_name = get_param(event, "index", "Work")
  text_key = get_param(event, "text_key", "title")  
  attributes = get_param(event, 
                         "attributes", 
                         "identifier,title,source,alternate_title,contributor,create_date,creator,date_created,description,genre,keywords,language,location,physical_description_material,physical_description_size,scope_and_contents,style_period,subject,table_of_contents,technique,work_type").split(",")

  weaviate = setup.weaviate_vector_store(index_name=index_name, 
                                         text_key=text_key, 
                                         attributes=attributes)
  
  client = setup.openai_chat_client()


  chain = RetrievalQAWithSourcesChain.from_chain_type(
    client, 
    chain_type="stuff", 
    retriever=weaviate.as_retriever(search_kwargs=dict(additional="certainty")),
    return_source_documents=True)

  response = chain({"question": question})
  print(response)
  response['source_documents'] = [doc.__dict__ for doc in response['source_documents']]
  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json"
    },
    "body": json.dumps(response)
  }


def get_param(event, parameter, default):
  params = event.get("queryStringParameters", {})
  return params.get(parameter, default)


def get_query(event):
  question = event.get("body", "")
  if event.get("isBase64Encoded", False):
    question = base64.b64decode(question)
  return question


def is_authenticated(event):
  headers = event.get("headers")
  token = headers.get("authorization", headers.get("Authorization", None))

  if token is None:
    for cookie in event.get("cookies", []):
      [k, v] = cookie.split("=", 1)
      if k == os.getenv("API_TOKEN_NAME"):
        token = v
  else:
    token = token.replace("Bearer ", "")
  
  return setup.validate_token(token)



# result = weaviate.similarity_search_by_text(query=question, 
#                                             additional="certainty")