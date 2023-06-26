# ruff: noqa: E501
import base64
import json
import os
import setup
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.prompts import PromptTemplate
from openai.error import InvalidRequestError

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

  prompt = """Given the following list of sources, create a final answer with references ("SOURCES").
  If you don't know the answer, just say that you don't know. Don't try to make up an answer.
  Don't include sources in the answer.

  QUESTION: What venues did musicians play at during the Berkeley Folk Music Festival?
  SOURCES: [Document(page_content='U.C. Folk Music Festival concerts', metadata={{'alternate_title': None, 'contributor': None, 'create_date': '2021-03-15T16:13:32.185430Z', 'creator': None, 'date_created': ['1961'], 'description': ['Newspaper clipping of an ad for Fourth Annual Berkeley Folk Music Festival concerts, July 1 and 2, 1961 at the Pauley Ballroom and Greek Theatre'], 'genre': ['clippings (information artifacts)'], 'identifier': '0b71f0fa-5ecd-4d1a-99c1-57b2110f9a92', 'keywords': None, 'language': ['English'], 'location': None, 'physical_description_material': None, 'physical_description_size': ['3 inches (height) x 6.5 inches (width)'], 'scope_and_contents': None, 'source': 'https://dc.library.northwestern.edu/items/0b71f0fa-5ecd-4d1a-99c1-57b2110f9a92', 'style_period': None, 'subject': ['University of California, Berkeley', 'Pauley Ballroom (Berkeley, Calif.)', 'William Randolph Hearst Greek Theatre (Berkeley, Calif.)', 'Berkeley Folk Music Festival (4th : 1961 : Berkeley, Calif.)'], 'table_of_contents': None, 'technique': None, 'work_type': 'Image'}}),
 Document(page_content='Sandy & Jeanie: the Darlingtons in concert', metadata={{'alternate_title': None, 'contributor': None, 'create_date': '2021-03-15T16:16:04.067341Z', 'creator': None, 'date_created': ['October 1967'], 'description': ['Flier for a performance by Sandy and Jeanie Darlington that was sponsored by the Central California (C.C.) Folk Music Club.'], 'genre': ['fliers (printed matter)'], 'identifier': '0c1ada30-a249-4a2f-b6fe-bbc975c6c0e4', 'keywords': None, 'language': ['English'], 'location': None, 'physical_description_material': None, 'physical_description_size': ['11 inches (height) x 8.5 inches (width)'], 'scope_and_contents': None, 'source': 'https://dc.library.northwestern.edu/items/0c1ada30-a249-4a2f-b6fe-bbc975c6c0e4', 'style_period': None, 'subject': ['Darlington, Sandy', 'Central California Folk Music Club', 'Sandy & Jeanie', 'Darlington, Jeanie'], 'table_of_contents': None, 'technique': None, 'work_type': 'Image'}}),
 Document(page_content='Details on the Fifth Annual U.C. Folk Music Festival', metadata={{'alternate_title': None, 'contributor': None, 'create_date': '2021-03-16T06:30:19.729729Z', 'creator': None, 'date_created': ['1962'], 'description': ["Details about the 1962 Berkeley Folk Music Festival, including artists fees, fees for previous years' Festivals, and a financial picture of 1962"], 'genre': ['financial records'], 'identifier': '9418f5ba-5953-477f-bda4-9a913f5ff06c', 'keywords': None, 'language': ['English'], 'location': None, 'physical_description_material': None, 'physical_description_size': ['11 inches (height) x 8.5 inches (width)'], 'scope_and_contents': None, 'source': 'https://dc.library.northwestern.edu/items/9418f5ba-5953-477f-bda4-9a913f5ff06c', 'style_period': None, 'subject': ['Berkeley Folk Music Festival (5th : 1962 : Berkeley, Calif.)'], 'table_of_contents': None, 'technique': None, 'work_type': 'Image'}}),
 Document(page_content='Singers stage grand finale of U.C. Folk Music Festival', metadata={{'alternate_title': None, 'contributor': ['Gessler, Clifford, 1893-1979'], 'create_date': '2021-03-16T03:25:40.456370Z', 'creator': None, 'date_created': ['July 3, 1961'], 'description': ['Review of the final concert of the 4th annual University of California, Berkeley Folk Music Festival, published in the July 3, 1961 Oakland Tribune'], 'genre': ['clippings (information artifacts)'], 'identifier': '6ab99e1a-14dc-44c7-9b9a-6dcb3667d32c', 'keywords': None, 'language': ['English'], 'location': None, 'physical_description_material': None, 'physical_description_size': ['9.75 inches (height) x 11 inches (width)'], 'scope_and_contents': None, 'source': 'https://dc.library.northwestern.edu/items/6ab99e1a-14dc-44c7-9b9a-6dcb3667d32c', 'style_period': None, 'subject': ['Oakland Tribune', 'Berkeley Folk Music Festival (4th : 1961 : Berkeley, Calif.)', 'Warner, Frank, 1903-1978'], 'table_of_contents': None, 'technique': None, 'work_type': 'Image'}}),
 Document(page_content='Schedules for U.C. folk music festival', metadata={{'alternate_title': None, 'contributor': None, 'create_date': '2021-03-16T06:05:19.400654Z', 'creator': None, 'date_created': ['June 25, 1965'], 'description': ['Complete schedules for Friday, June 25 and Saturday, June 26 at the Eighth Annual Berkeley Folk Music Festival, clipped from the June 25, 1965 issue of the Oakland Tribune'], 'genre': ['clippings (information artifacts)'], 'identifier': '8ee42f27-ea0c-45d9-a7fa-3ffea65bbd45', 'keywords': None, 'language': ['English'], 'location': None, 'physical_description_material': None, 'physical_description_size': ['10 inches (height) x 3.75 inches (width)'], 'scope_and_contents': None, 'source': 'https://dc.library.northwestern.edu/items/8ee42f27-ea0c-45d9-a7fa-3ffea65bbd45', 'style_period': None, 'subject': ['Oakland Tribune', 'Berkeley (Calif.)', 'Berkeley Folk Music Festival (8th : 1965 : Berkeley, Calif.)'], 'table_of_contents': None, 'technique': None, 'work_type': 'Image'}})]
  FINAL ANSWER: Based on the provided documents, here are the venues that were used for performances by musicians at the Berkeley Folk Music Festival:

1. Fourth Annual Berkeley Folk Music Festival (1961):
   - Pauley Ballroom and Greek Theatre

2. Fifth Annual Berkeley Folk Music Festival (1962):
   - No specific venue mentioned in the provided document.

3. Eighth Annual Berkeley Folk Music Festival (1965):
   - No specific venue mentioned in the provided document.

Please note that the documents do not provide information on the venues used for the Fifth and Eighth Annual Berkeley Folk Music Festivals.

  QUESTION: {question}
  =========
  {summaries}
  =========
  FINAL ANSWER:"""

  prompt_template = PromptTemplate(template=prompt, input_variables=["question", "summaries"])

  docs = weaviate.similarity_search(question, k=10, additional="certainty")
  print(docs)
  chain = load_qa_with_sources_chain(client, chain_type="stuff", prompt=prompt_template)
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
      "access-control-allow-origin": get_header(event, "Origin", "*"),
      "access-control-allow-headers": "Accept, Accept-Charset, Accept-Encoding, Accept-Language, Accept-Datetime, Authorization, Cache-Control, Content-Length, Content-Type, Cookie, Date, Expect, Host, If-Match, If-Modified-Since, If-None-Match, If-Range, If-Unmodified-Since, Origin, Pragma, Range, Referer, User-Agent, X-CSRF-Token, X-Forwarded-For, X-Forwarded-Host, X-Forwarded-Port, X-Requested-With"
    },
    "body": json.dumps(response)
  }

def get_header(event, header, default=None):
  headers = event.get("headers")
  return headers.get(header, headers.get(header.lower(), default))

def get_param(event, parameter, default):
  params = event.get("queryStringParameters", {})
  return params.get(parameter, default)


def get_query(event):
  print(event)
  if event["requestContext"]["http"]["method"] == "GET":
    return get_param(event, "q", "")
  
  question = event.get("body", "")
  if event.get("isBase64Encoded", False):
    question = base64.b64decode(question)
  return question


def is_authenticated(event):
  token = get_header(event, "Authorization")

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