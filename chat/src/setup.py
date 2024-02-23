from content_handler import ContentHandler
from langchain_community.chat_models import AzureChatOpenAI
from langchain_community.embeddings import SagemakerEndpointEmbeddings
from langchain_community.vectorstores import OpenSearchVectorSearch
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import os
import boto3

def prefix(value):
    env_prefix = os.getenv("ENV_PREFIX")
    env_prefix = None if env_prefix == "" else env_prefix
    return '-'.join(filter(None, [env_prefix, value]))

def openai_chat_client(**kwargs):
    return AzureChatOpenAI(
        openai_api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        **kwargs,
    )

def opensearch_client(region_name=os.getenv("AWS_REGION")):
    print(region_name)
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(region=region_name, service="es", refreshable_credentials=session.get_credentials())
    endpoint = os.getenv("ELASTICSEARCH_ENDPOINT")

    return OpenSearch(
        hosts=[{'host': endpoint, 'port': 443}],
        use_ssl = True,
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
    )

def opensearch_vector_store(region_name=os.getenv("AWS_REGION")):
    session = boto3.Session(region_name=region_name)
    awsauth = AWS4Auth(region=region_name, service="es", refreshable_credentials=session.get_credentials())

    sagemaker_client = session.client(service_name="sagemaker-runtime", region_name=session.region_name)
    embeddings = SagemakerEndpointEmbeddings(
        client=sagemaker_client,
        region_name=session.region_name,
        endpoint_name=os.getenv("EMBEDDING_ENDPOINT"),
        content_handler=ContentHandler()
    )

    docsearch = OpenSearchVectorSearch(
        index_name=prefix("dc-v2-work"),
        embedding_function=embeddings,
        opensearch_url="https://" + os.getenv("ELASTICSEARCH_ENDPOINT"),
        connection_class=RequestsHttpConnection,
        http_auth=awsauth,
    )
    return docsearch


def websocket_client(endpoint_url: str):
    endpoint_url = endpoint_url or os.getenv("APIGATEWAY_URL")
    try:
        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)
        return client
    except Exception as e:
        raise e