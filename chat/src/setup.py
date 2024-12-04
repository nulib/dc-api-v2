from langchain_openai import AzureChatOpenAI
from handlers.opensearch_neural_search import OpenSearchNeuralSearch
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
from urllib.parse import urlparse
import os
import boto3


def prefix(value):
    env_prefix = os.getenv("ENV_PREFIX")
    env_prefix = None if env_prefix == "" else env_prefix
    return "-".join(filter(None, [env_prefix, value]))


def openai_chat_client(**kwargs):
    return AzureChatOpenAI(
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version=os.getenv("AZURE_API_VERSION", "2024-08-01-preview"),
        azure_endpoint=f"https://{os.getenv("AZURE_OPENAI_RESOURCE_NAME")}.openai.azure.com",
        **kwargs,
    )


def opensearch_endpoint():
    endpoint = os.getenv("OPENSEARCH_ENDPOINT")
    parsed = urlparse(endpoint)
    if parsed.netloc != "":
        return parsed.netloc
    else:
        return endpoint


def opensearch_client(region_name=os.getenv("AWS_REGION")):
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(
        region=region_name,
        service="es",
        refreshable_credentials=session.get_credentials(),
    )
    endpoint = opensearch_endpoint()

    return OpenSearch(
        hosts=[{"host": endpoint, "port": 443}],
        use_ssl=True,
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
    )


def opensearch_vector_store(region_name=os.getenv("AWS_REGION")):
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(
        region=region_name,
        service="es",
        refreshable_credentials=session.get_credentials(),
    )

    docsearch = OpenSearchNeuralSearch(
        index=prefix("dc-v2-work"),
        model_id=os.getenv("OPENSEARCH_MODEL_ID"),
        endpoint=opensearch_endpoint(),
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
        text_field="id",
    )
    return docsearch


def websocket_client(endpoint_url: str):
    endpoint_url = endpoint_url or os.getenv("APIGATEWAY_URL")
    try:
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        return client
    except Exception as e:
        raise e
