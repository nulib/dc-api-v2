import boto3
import json
import os

def load_secrets():
  SecretsPath = os.getenv('SECRETS_PATH')
  EnvironmentMap = [
    ['API_TOKEN_SECRET', 'dcapi', 'api_token_secret'],
    ['OPENSEARCH_ENDPOINT', 'index', 'endpoint'],
    ['OPENSEARCH_MODEL_ID', 'index', 'embedding_model']
  ]

  client = boto3.client("secretsmanager")
  response = client.batch_get_secret_value(SecretIdList=[
    f'{SecretsPath}/infrastructure/index',
    f'{SecretsPath}/config/dcapi'
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
