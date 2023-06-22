import os
import weaviate
from weaviate.util import generate_uuid5



def connect():
  weaviate_url = os.environ['WEAVIATE_URL']
  weaviate_api_key = os.environ['WEAVIATE_API_KEY']
  openai_api_key = os.environ['AZURE_OPENAI_API_KEY']

  auth_config = weaviate.AuthApiKey(api_key=weaviate_api_key)

  return weaviate.Client(
      url=weaviate_url,
      auth_client_secret=auth_config,
      additional_headers={
          "X-OpenAI-Api-Key": openai_api_key
      }
  )