from persistence.selective_checkpointer import SelectiveCheckpointer
from search.opensearch_neural_search import OpenSearchNeuralSearch
from langchain_aws import ChatBedrock
from langchain_core.language_models.base import BaseModel
from langgraph.checkpoint.base import BaseCheckpointSaver
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
from urllib.parse import urlparse
import os
import boto3


def chat_model(**kwargs) -> BaseModel:
    return ChatBedrock(**kwargs)


def checkpoint_saver(**kwargs) -> BaseCheckpointSaver:
    checkpoint_bucket: str = os.getenv("CHECKPOINT_BUCKET_NAME")
    return SelectiveCheckpointer(
        bucket_name=checkpoint_bucket, retain_history=False, **kwargs
    )


def prefix(value):
    env_prefix = os.getenv("ENV_PREFIX")
    env_prefix = None if env_prefix == "" else env_prefix
    return "-".join(filter(None, [env_prefix, value]))


def opensearch_endpoint():
    endpoint = os.getenv("OPENSEARCH_ENDPOINT")
    parsed = urlparse(endpoint)
    if parsed.netloc != "":
        return parsed.netloc
    else:
        return endpoint


def opensearch_client(region_name=None):
    region_name = region_name or os.getenv("AWS_REGION")  # Evaluate at runtime
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


def opensearch_vector_store(region_name=None):
    region_name = region_name or os.getenv("AWS_REGION")  # Evaluate at runtime
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
