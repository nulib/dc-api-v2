import unittest
from unittest.mock import patch, MagicMock
import os
from opensearchpy import RequestsHttpConnection

from core.setup import chat_model, checkpoint_saver, prefix, opensearch_endpoint, opensearch_client, opensearch_vector_store, websocket_client


class TestChatModel(unittest.TestCase):
    def test_chat_model_returns_bedrock_instance(self):
        kwargs = {"model_id": "test_model"}
        with patch("core.setup.ChatBedrock") as mock_bedrock:
            result = chat_model(**kwargs)
            mock_bedrock.assert_called_once_with(**kwargs)
            self.assertEqual(result, mock_bedrock.return_value)

class TestCheckpointSaver(unittest.TestCase):
    @patch.dict(os.environ, {"CHECKPOINT_BUCKET_NAME": "test-bucket"})
    @patch("core.setup.S3Checkpointer")
    def test_checkpoint_saver_initialization(self, mock_s3_checkpointer):
        kwargs = {"prefix": "test"}
        result = checkpoint_saver(**kwargs)
        
        mock_s3_checkpointer.assert_called_once_with(
            bucket_name="test-bucket",
            **kwargs
        )
        self.assertEqual(result, mock_s3_checkpointer.return_value)

class TestPrefix(unittest.TestCase):
    def test_prefix_with_env_prefix(self):
        with patch.dict(os.environ, {"ENV_PREFIX": "dev"}):
            result = prefix("test")
            self.assertEqual(result, "dev-test")

    def test_prefix_without_env_prefix(self):
        with patch.dict(os.environ, {"ENV_PREFIX": ""}):
            result = prefix("test")
            self.assertEqual(result, "test")

    def test_prefix_with_none_env_prefix(self):
        with patch.dict(os.environ, clear=True):
            result = prefix("test")
            self.assertEqual(result, "test")

class TestOpenSearchEndpoint(unittest.TestCase):
    def test_opensearch_endpoint_with_full_url(self):
        with patch.dict(os.environ, {"OPENSEARCH_ENDPOINT": "https://test.amazonaws.com"}):
            result = opensearch_endpoint()
            self.assertEqual(result, "test.amazonaws.com")

    def test_opensearch_endpoint_with_hostname(self):
        with patch.dict(os.environ, {"OPENSEARCH_ENDPOINT": "test.amazonaws.com"}):
            result = opensearch_endpoint()
            self.assertEqual(result, "test.amazonaws.com")

class TestOpenSearchClient(unittest.TestCase):
    @patch("core.setup.boto3.Session")
    @patch("core.setup.AWS4Auth")
    @patch("core.setup.OpenSearch")
    def test_opensearch_client_initialization(self, mock_opensearch, mock_aws4auth, mock_session):
        # Setup mock credentials
        mock_credentials = MagicMock()
        mock_session.return_value.get_credentials.return_value = mock_credentials
        
        with patch.dict(os.environ, {
            "AWS_REGION": "us-west-2",
            "OPENSEARCH_ENDPOINT": "test.amazonaws.com"
        }):
            _result = opensearch_client()
            
            # Verify AWS4Auth initialization
            mock_aws4auth.assert_called_once_with(
                region="us-west-2",
                service="es",
                refreshable_credentials=mock_credentials
            )
            
            # Verify OpenSearch initialization
            mock_opensearch.assert_called_once_with(
                hosts=[{"host": "test.amazonaws.com", "port": 443}],
                use_ssl=True,
                connection_class=RequestsHttpConnection,
                http_auth=mock_aws4auth.return_value
            )

class TestOpenSearchVectorStore(unittest.TestCase):
    @patch("core.setup.boto3.Session")
    @patch("core.setup.AWS4Auth")
    @patch("core.setup.OpenSearchNeuralSearch")
    def test_opensearch_vector_store_initialization(self, mock_neural_search, mock_aws4auth, mock_session):
        # Setup mock credentials
        mock_credentials = MagicMock()
        mock_session.return_value.get_credentials.return_value = mock_credentials
        
        with patch.dict(os.environ, {
            "AWS_REGION": "us-west-2",
            "OPENSEARCH_ENDPOINT": "test.amazonaws.com",
            "OPENSEARCH_MODEL_ID": "test-model",
            "ENV_PREFIX": "dev"
        }):
            _result = opensearch_vector_store()
            
            # Verify AWS4Auth initialization
            mock_aws4auth.assert_called_once_with(
                region="us-west-2",
                service="es",
                refreshable_credentials=mock_credentials
            )
            
            # Verify OpenSearchNeuralSearch initialization
            mock_neural_search.assert_called_once_with(
                index="dev-dc-v2-work",
                model_id="test-model",
                endpoint="test.amazonaws.com",
                connection_class=RequestsHttpConnection,
                http_auth=mock_aws4auth.return_value,
                text_field="id"
            )

class TestWebsocketClient(unittest.TestCase):
    @patch("core.setup.boto3.client")
    def test_websocket_client_with_provided_endpoint(self, mock_boto3_client):
        endpoint_url = "https://test-ws.amazonaws.com"
        result = websocket_client(endpoint_url)
        
        mock_boto3_client.assert_called_once_with(
            "apigatewaymanagementapi",
            endpoint_url=endpoint_url
        )
        self.assertEqual(result, mock_boto3_client.return_value)

    @patch("core.setup.boto3.client")
    def test_websocket_client_with_env_endpoint(self, mock_boto3_client):
        with patch.dict(os.environ, {"APIGATEWAY_URL": "https://test-ws-env.amazonaws.com"}):
            result = websocket_client(None)
            
            mock_boto3_client.assert_called_once_with(
                "apigatewaymanagementapi",
                endpoint_url="https://test-ws-env.amazonaws.com"
            )
            self.assertEqual(result, mock_boto3_client.return_value)

    @patch("core.setup.boto3.client")
    def test_websocket_client_error_handling(self, mock_boto3_client):
        mock_boto3_client.side_effect = Exception("Connection error")
        
        with self.assertRaises(Exception):
            websocket_client("https://test-ws.amazonaws.com")