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

  prompt = """Given the following list of sources, create a helpful answer to the supplied question.
  If you don't know the answer, just say that you don't know. Don't try to make up an answer.
  Don't include sources in the answer.

  Content: 10th Annual Berkeley Folk Music Festival brochure
  Metadata: 
    alternate_title: ['Tenth Annual Berkeley Folk Music Festival brochure']
    contributor: ['University of California, Berkeley. Associated Students', 'Olivier, Barry, 1935-', 'Herrero, Lowell, 1921-']
    create_date: 2021-03-16T17:07:28.356507Z
    creator: None
    date_created: ['1967']
    description: ['Brochure for the 10th Annual Berkeley Folk Music Festival, June 30 - July 4, 1967 at the University of California, Berkeley. Includes event schedule, photos and brief descriptions of participating artists and folklorists, and ticket information. Front cover features a Lowell Herrero illustration of Uncle Sam playing guitar.']
    genre: ['brochures']
    identifier: ce3ca54a-d928-43b8-bd1f-0b867e1fd624
    keywords: None
    language: ['English']
    location: None
    physical_description_material: None
    physical_description_size: ['11 inches (height) x 4.25 inches (width)', '11 inches (height) x 16.75 inches (width)', '11 inches (height) x 8.5 inches (width)']
    scope_and_contents: None
    style_period: None
    subject: ['Berkeley (Calif.)', 'University of California, Berkeley', 'Davis, Gary, 1896-1972', 'James Cotton Blues Band', 'Havens, Richie', 'Ian, Janis', 'Thomas, Tony, 1913-', 'Watson, Doc', 'Darlington, Sandy', 'Steve Miller Blues Band', 'Green, Archie', 'Hinton, Sam, 1917-2009', 'Charles River Valley Boys (Musical group)', 'Crome Syrcus (Musical group)', 'Kaleidoscope (Musical group)', 'Marshall, Charley', 'Berkeley Folk Music Festival (10th : 1967 : Berkeley, Calif.)', 'Spector, Phil', 'Von Meier, Kurt', 'Gleason, Ralph J.', 'Country Joe and the Fish', 'Red Crayola (Musical group)', 'Goodfellow, Robin, 1940-2017', 'Darlington, Jeanie', 'Cleanliness and Godliness Skiffle Band', 'Tarlton, Jimmie, 1892-1979']
    table_of_contents: None
    technique: None
    work_type: Image
  Source: https://dc.library.northwestern.edu/items/ce3ca54a-d928-43b8-bd1f-0b867e1fd624
  


  Content: University of California Folk Music Festival
  Metadata: 
    alternate_title: None
    contributor: ['Olivier, Barry, 1935-']
    create_date: 2021-03-16T13:09:52.290256Z
    creator: None
    date_created: ['1961?']
    description: ['Description of the Berkeley Folk Music Festival, and the financial arrangements between Festival organizers and the Committee for Arts and Lectures']
    genre: ['descriptions (documents)', 'financial records']
    identifier: a2979042-4e76-4808-ab1a-5eb0bd39ffda
    keywords: None
    language: ['English']
    location: None
    physical_description_material: None
    physical_description_size: ['11 inches (height) x 8.5 inches (width)']
    scope_and_contents: None
    style_period: None
    subject: ['Berkeley Folk Music Festival', 'University of California, Berkeley. Committee on Drama, Lectures, and Music']
    table_of_contents: None
    technique: None
    work_type: Image
  Source: https://dc.library.northwestern.edu/items/a2979042-4e76-4808-ab1a-5eb0bd39ffda
  


  Content: Mitch Greenhill
  Metadata: 
    alternate_title: None
    contributor: ['Olivier, Barry, 1935-']
    create_date: 2021-03-16T21:54:44.763820Z
    creator: None
    date_created: ['circa 1958 to circa 1970']
    description: ['Cut out photo of Mitch Greenhill playing guitar in an outdoor setting at the San Diego Folk Festival. Back includes performance schedule at the Berkeley Folk Music Festival.']
    genre: ['black-and-white photographs']
    identifier: f2ee01cf-ebe9-44b2-8293-b2f98f982aea
    keywords: None
    language: None
    location: None
    physical_description_material: None
    physical_description_size: ['7.5 inches (height) x 4.75 inches (width)']
    scope_and_contents: None
    style_period: None
    subject: ['San Diego (Calif.)', 'Greenhill, Mitch', 'San Diego Folk Festival']
    table_of_contents: None
    technique: None
    work_type: Image
  Source: https://dc.library.northwestern.edu/items/f2ee01cf-ebe9-44b2-8293-b2f98f982aea
  


  Content: Purchase order and invoice
  Metadata: 
    alternate_title: None
    contributor: ['Berkeley Folk Music Festival', 'University of California, Berkeley. Associated Students']
    create_date: 2021-03-15T16:22:45.637252Z
    creator: None
    date_created: ['July 13, 1962 and July 30, 1962']
    description: ['ASUC purchase order issued on behalf of the Berkeley Folk Music Festival to the Regents of the University of California, with accompanying invoice']
    genre: ['purchase orders']
    identifier: 0df68024-5b07-46d8-87b3-2efc6b22f9d7
    keywords: None
    language: ['English']
    location: None
    physical_description_material: None
    physical_description_size: ['5.5 inches (height) x 8.5 inches (width)', '7 inches (height) x 8.5 inches (width)']
    scope_and_contents: None
    style_period: None
    subject: ['University of California (System). Regents', 'Berkeley Folk Music Festival (5th : 1962 : Berkeley, Calif.)']
    table_of_contents: None
    technique: None
    work_type: Image
  Source: https://dc.library.northwestern.edu/items/0df68024-5b07-46d8-87b3-2efc6b22f9d7

  QUESTION: What venues did musicians play at during the Berkeley Folk Music Festival?
  HELPFUL ANSWER: Based on the provided documents, here are the venues that were used for performances by musicians at the Berkeley Folk Music Festival:

1. Fourth Annual Berkeley Folk Music Festival (1961):
   - Pauley Ballroom and Greek Theatre

2. Fifth Annual Berkeley Folk Music Festival (1962):
   - No specific venue mentioned in the provided document.

3. Eighth Annual Berkeley Folk Music Festival (1965):
   - No specific venue mentioned in the provided document.

Please note that the documents do not provide information on the venues used for the Fifth and Eighth Annual Berkeley Folk Music Festivals.

  {context}

  QUESTION: {question}  
  =========
  HELPFUL ANSWER:"""

  prompt_template = PromptTemplate(template=prompt, input_variables=["question", "context"])

  document_template = """
  Content: {page_content}
  Metadata: 
    alternate_title: {alternate_title}
    contributor: {contributor}
    create_date: {create_date}
    creator: {creator}
    date_created: {date_created}
    description: {description}
    genre: {genre}
    identifier: {identifier}
    keywords: {keywords}
    language: {language}
    location: {location}
    physical_description_material: {physical_description_material}
    physical_description_size: {physical_description_size}
    scope_and_contents: {scope_and_contents}
    style_period: {style_period}
    subject: {subject}
    table_of_contents: {table_of_contents}
    technique: {technique}
    work_type: {work_type}
  Source: {source}
  """

  document_prompt = PromptTemplate(
    template=document_template,
    input_variables=["page_content"] + [item for item in attributes if item != "title"],
  )

  docs = weaviate.similarity_search(question, k=10, additional="certainty")
  print(docs)
  chain = load_qa_with_sources_chain(client, chain_type="stuff", prompt=prompt_template, document_prompt=document_prompt, document_variable_name="context", verbose=True)
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