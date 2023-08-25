from langchain.chat_models import AzureChatOpenAI
from langchain.vectorstores import Weaviate
from typing import List
import os
import weaviate

def openai_chat_client():
  deployment = os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT_ID")
  key = os.getenv("AZURE_OPENAI_API_KEY")
  resource = os.getenv("AZURE_OPENAI_RESOURCE_NAME")
  version = "2023-07-01-preview"

  return AzureChatOpenAI(deployment_name=deployment, 
                         openai_api_key=key, 
                         openai_api_base=f"https://{resource}.openai.azure.com/",
                         openai_api_version=version)
                         


def weaviate_vector_store(index_name: str, text_key: str, attributes: List[str] = []):
  weaviate_url = os.environ['WEAVIATE_URL']
  weaviate_api_key = os.environ['WEAVIATE_API_KEY']
  # openai_api_key = os.environ['AZURE_OPENAI_API_KEY']

  auth_config = weaviate.AuthApiKey(api_key=weaviate_api_key)

  client = weaviate.Client(
      url=weaviate_url,
      auth_client_secret=auth_config
  )
  return Weaviate(client=client, 
                  index_name=index_name, 
                  text_key=text_key, 
                  attributes=attributes)
