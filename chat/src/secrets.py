import boto3
import json
import os

def load_secrets():
  SecretsPath = os.getenv('SECRETS_PATH')
  EnvironmentMap = [
    ['OPENSEARCH_ENDPOINT', 'index', 'endpoint'],
    ['OPENSEARCH_MODEL_ID', 'index', 'embedding_model'],
    ['AZURE_OPENAI_API_KEY', 'azure_openai', 'api_key'],
    ['AZURE_OPENAI_LLM_DEPLOYMENT_ID', 'azure_openai', 'llm_deployment_id'],
    ['AZURE_OPENAI_RESOURCE_NAME', 'azure_openai', 'resource_name']
  ]

  client = boto3.client("secretsmanager")
  response = client.batch_get_secret_value(SecretIdList=[
    f'{SecretsPath}/infrastructure/index',
    f'{SecretsPath}/infrastructure/azure_openai'
  ])

  secrets = {
    secret['Name'].split('/')[-1]: json.loads(secret['SecretString'])
    for secret
    in response['SecretValues']
  }

  for var, name, key in EnvironmentMap:
    value = secrets.get(name, {}).get(key)
    
    if var not in os.environ and value is not None:
      os.environ[var] = value

  os.environ['__SKIP_SECRETS__'] = 'true'

if not os.getenv('__SKIP_SECRETS__'):
  load_secrets()
