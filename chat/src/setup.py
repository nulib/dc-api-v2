from content_handler import ContentHandler
from langchain_community.chat_models import BedrockChat
from handlers.opensearch_neural_search import OpenSearchNeuralSearch
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import os
import boto3

def prefix(value):
    env_prefix = os.getenv("ENV_PREFIX")
    env_prefix = None if env_prefix == "" else env_prefix
    return '-'.join(filter(None, [env_prefix, value]))

def bedrock_chat_client(model_id=os.getenv("AI_MODEL_ID"), region_name=os.getenv("AWS_REGION"), **kwargs):
    return BedrockChat(model_id=model_id, region_name=region_name, **kwargs)

def opensearch_client(region_name=os.getenv("AWS_REGION")):
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(region=region_name, service="es", refreshable_credentials=session.get_credentials())
    endpoint = os.getenv("OPENSEARCH_ENDPOINT")

    return OpenSearch(
        hosts=[{'host': endpoint, 'port': 443}],
        use_ssl = True,
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
    )

def opensearch_vector_store(region_name=os.getenv("AWS_REGION"), index_name="dc-v2-work"):
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(region=region_name, service="es", refreshable_credentials=session.get_credentials())

    docsearch = OpenSearchNeuralSearch(
        index=prefix("dc-v2-work"),
        model_id=os.getenv("OPENSEARCH_MODEL_ID"),
        endpoint=os.getenv("OPENSEARCH_ENDPOINT"),
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
        search_pipeline=prefix("dc-v2-work-pipeline"),
        text_field= "id"
    )
    return docsearch


def websocket_client(endpoint_url: str):
    endpoint_url = endpoint_url or os.getenv("APIGATEWAY_URL")
    try:
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        return client
    except Exception as e:
        raise e