import json
import os
import setup
from helpers.event import Event
from helpers.prompts import document_template, prompt_template
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.prompts import PromptTemplate
from openai.error import InvalidRequestError

ALLOW_HEADERS = ("Accept, Accept-Charset, Accept-Encoding, Accept-Language, "
                 "Accept-Datetime, Authorization, Cache-Control, Content-Length, "
                 "Content-Type, Cookie, Date, Expect, Host, If-Match, "
                 "If-Modified-Since, If-None-Match, If-Range, If-Unmodified-Since, "
                 "Origin, Pragma, Range, Referer, User-Agent, X-CSRF-Token, "
                 "X-Forwarded-For, X-Forwarded-Host, X-Forwarded-Port, "
                 "X-Requested-With")
DEFAULT_INDEX = "Work"
DEFAULT_KEY = "title"
DEFAULT_ATTRIBUTES = ("alternate_title,contributor,create_date,"
                      "creator,date_created,description,genre,keywords,language,location,"
                      "physical_description_material,physical_description_size,scope_and_contents,"
                      "style_period,subject,table_of_contents,technique,work_type")

def handler(event, context):
  event = Event(event)
  if not event.api_token.is_logged_in():
    return {
    "statusCode": 401,
    "headers": {
      "Content-Type": "text/plain"
    },
    "body": "Unauthorized"
  }
  question = event.body() if event.is_post_request() else event.param("q", "") 
  index_name = event.param("index", DEFAULT_INDEX)
  text_key = event.param("text_key", DEFAULT_KEY)  
  attributes = [
    item for item 
    in set(event.param("attributes", DEFAULT_ATTRIBUTES).split(",")) 
    if item not in [text_key, "source"]
  ]

  weaviate = setup.weaviate_vector_store(index_name=index_name, 
                                         text_key=text_key, 
                                         attributes=attributes + ["source"])
  
  client = setup.openai_chat_client()

  prompt = PromptTemplate(
    template=prompt_template(), 
    input_variables=["question", "context"]
  )

  document_prompt = PromptTemplate(
    template=document_template(attributes),
    input_variables=["page_content", "source"] + attributes,
  )

  docs = weaviate.similarity_search(question, k=10, additional="certainty")
  chain = load_qa_with_sources_chain(
    client, 
    chain_type="stuff", 
    prompt=prompt, 
    document_prompt=document_prompt, 
    document_variable_name="context", 
    verbose=to_bool(os.getenv("VERBOSE"))
  )
  
  try:
    response = chain({"question": question, "input_documents": docs})
    response = {
      "question": response["question"],
      "answer": response["output_text"],
      "source_documents": [doc.__dict__ for doc in response['input_documents']]
    }
  except InvalidRequestError as err:
    response = {
      "question": question,
      "answer": str(err),
      "source_documents": []
    }

  return {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json",
      "access-control-allow-methods": "POST, GET",
      "access-control-allow-credentials": True,
      "access-control-max-age": 600,
      "access-control-allow-origin": event.header("Origin", "*"),
      "access-control-allow-headers": ALLOW_HEADERS
    },
    "body": json.dumps(response)
  }

def to_bool(val):
  if isinstance(val, str):
    return val.lower() not in ["", "no", "false", "0"]
  return bool(val)
