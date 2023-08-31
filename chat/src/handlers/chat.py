import boto3
import json
import os
import setup
from helpers.apitoken import ApiToken
from helpers.prompts import document_template, prompt_template
from langchain.callbacks.base import BaseCallbackHandler
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.prompts import PromptTemplate
from openai.error import InvalidRequestError

DEFAULT_INDEX = "Work"
DEFAULT_KEY = "title"
DEFAULT_ATTRIBUTES = ("title,alternate_title,collection,contributor,creator,"
                      "date_created,description,genre,language,library_unit,"
                      "location,physical_description_material,physical_description_size,"
                      "published,rights_statement,scope_and_contents,series,source,"
                      "style_period,subject,table_of_contents,technique,visibility,"
                      "work_type")

class Websocket:
  def __init__(self, endpoint_url, connection_id, ref):
    self.client = boto3.client('apigatewaymanagementapi', endpoint_url=endpoint_url)
    self.connection_id = connection_id
    self.ref = ref

  def send(self, data):
    data['ref'] = self.ref
    data_as_bytes = bytes(json.dumps(data), 'utf-8')
    self.client.post_to_connection(Data=data_as_bytes, ConnectionId=self.connection_id)

class StreamingSocketCallbackHandler(BaseCallbackHandler):
  def __init__(self, socket: Websocket):
    self.socket = socket
  
  def on_llm_new_token(self, token: str, **kwargs):
    self.socket.send({'token': token});

def handler(event, context):
  try:
    payload = json.loads(event.get('body', '{}'))

    request_context = event.get('requestContext', {})
    connection_id = request_context.get('connectionId')
    endpoint_url = f'https://{request_context.get("domainName")}/{request_context.get("stage")}'
    ref = payload.get('ref')
    socket = Websocket(connection_id=connection_id, endpoint_url=endpoint_url, ref=ref)


    api_token = ApiToken(signed_token=payload.get("auth"))
    if not api_token.is_logged_in():
      socket.send({ "statusCode": 401, "body": "Unauthorized" })
      return {
        "statusCode": 401,
        "body": "Unauthorized"
      }

    question = payload.get("question")
    index_name = payload.get("index", DEFAULT_INDEX)
    text_key = payload.get("text_key", DEFAULT_KEY)  
    attributes = [
      item for item 
      in set(payload.get("attributes", DEFAULT_ATTRIBUTES).split(",")) 
      if item not in [text_key, "source"]
    ]

    weaviate = setup.weaviate_vector_store(index_name=index_name, 
                                          text_key=text_key, 
                                          attributes=attributes + ["source"])
    
    client = setup.openai_chat_client(callbacks=[StreamingSocketCallbackHandler(socket)], streaming=True)

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
      doc_response = [doc.__dict__ for doc in docs]
      socket.send({"question": question, "source_documents": doc_response})
      response = chain({"question": question, "input_documents": docs})
      response = {
        "answer": response["output_text"],
      }
      socket.send(response)
    except InvalidRequestError as err:
      response = {
        "question": question,
        "answer": str(err),
        "source_documents": []
      }
      socket.send(response)

    return {'statusCode': 200}
  except Exception as err:
    print(event)
    raise err

def to_bool(val):
  if isinstance(val, str):
    return val.lower() not in ["", "no", "false", "0"]
  return bool(val)
