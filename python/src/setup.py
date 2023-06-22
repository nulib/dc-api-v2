from langchain.chat_models import AzureChatOpenAI
from langchain.vectorstores import Weaviate
from typing import List
import openai
import os
import jwt
import weaviate

def openai_chat_client():
  deployment = os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT_ID")
  resource = os.getenv("AZURE_OPENAI_RESOURCE_NAME")
  api_key = os.getenv("AZURE_OPENAI_API_KEY")

  return AzureChatOpenAI(deployment_name=deployment)

def weaviate_vector_store(index_name: str, text_key: str, attributes: List[str] = []):
  weaviate_url = os.environ['WEAVIATE_URL']
  weaviate_api_key = os.environ['WEAVIATE_API_KEY']
  openai_api_key = os.environ['AZURE_OPENAI_API_KEY']

  auth_config = weaviate.AuthApiKey(api_key=weaviate_api_key)

  client = weaviate.Client(
      url=weaviate_url,
      auth_client_secret=auth_config,
      additional_headers={
          "X-OpenAI-Api-Key": openai_api_key
      }
  )
  return Weaviate(client=client, index_name=index_name, text_key=text_key, attributes=attributes)


def validate_token(token):
  secret = os.getenv("API_TOKEN_SECRET")
  try:
    claim = jwt.decode(token, secret, algorithms=["HS256"])
    print(f"CLAIM: {claim}")
    return claim.get("isLoggedIn", False)
  except Exception as e:
    print(e)
    return False