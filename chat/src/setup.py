from langchain.chat_models import AzureChatOpenAI
from langchain.vectorstores import Weaviate
from typing import List
import os
import weaviate
import boto3


def openai_chat_client(**kwargs):
    return AzureChatOpenAI(
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        **kwargs,
    )


def weaviate_client():
    if os.getenv("SKIP_WEAVIATE_SETUP"):
        return None
    
    weaviate_url = os.environ.get("WEAVIATE_URL")
    try:
        if weaviate_url is None:
            raise EnvironmentError(
                "WEAVIATE_URL is not set in the environment variables"
            )

        weaviate_api_key = os.environ.get("WEAVIATE_API_KEY")
        if weaviate_api_key is None:
            raise EnvironmentError(
                "WEAVIATE_API_KEY is not set in the environment variables"
            )

        auth_config = weaviate.AuthApiKey(api_key=weaviate_api_key)

        client = weaviate.Client(url=weaviate_url, auth_client_secret=auth_config)
    except Exception as e:
        print(f"An error occurred: {e}")
        client = None
    return client


def weaviate_vector_store(index_name: str, text_key: str, attributes: List[str] = []):
    if os.getenv("SKIP_WEAVIATE_SETUP"):
        return None
    
    client = weaviate_client()

    return Weaviate(
        client=client, index_name=index_name, text_key=text_key, attributes=attributes
    )


def websocket_client(endpoint_url: str):
    endpoint_url = endpoint_url or os.getenv("APIGATEWAY_URL")
    try:
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        return client
    except Exception as e:
        raise e