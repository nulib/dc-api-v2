import boto3
import os
import pytest
from moto import mock_aws
from unittest import TestCase

from core.secrets import load_secrets

@mock_aws
@mock_aws
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
class TestSecrets(TestCase):
    def setUp(self):
        client = boto3.client("secretsmanager", region_name="us-east-1")
        client.create_secret(
            Name="mock/infrastructure/index",
            SecretString='{"endpoint": "https://opensearch-endpoint", "embedding_model": "opensearch-model"}')
        client.create_secret(
            Name="mock/config/dcapi",
            SecretString='{"api_token_secret": "dcapi-token"}')

    def test_load_secrets(self):
        os.environ['SECRETS_PATH'] = 'mock'
        self.assertNotEqual('dcapi-token', os.getenv('API_TOKEN_SECRET'))
        self.assertNotEqual('https://opensearch-endpoint', os.getenv('OPENSEARCH_ENDPOINT'))
        self.assertNotEqual('opensearch-model', os.getenv('OPENSEARCH_MODEL_ID'))
        load_secrets()
        self.assertEqual('dcapi-token', os.getenv('API_TOKEN_SECRET'))
        self.assertEqual('https://opensearch-endpoint', os.getenv('OPENSEARCH_ENDPOINT'))
        self.assertEqual('opensearch-model', os.getenv('OPENSEARCH_MODEL_ID'))
