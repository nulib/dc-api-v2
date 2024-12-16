import boto3
import json
import os

def load_secrets(SecretsPath=os.getenv('SECRETS_PATH')):
  EnvironmentMap = [
    ['API_TOKEN_SECRET', 'dcapi', 'api_token_secret'],
    ['OPENSEARCH_ENDPOINT', 'index', 'endpoint'],
    ['OPENSEARCH_MODEL_ID', 'index', 'embedding_model']
  ]

  client = boto3.client("secretsmanager", region_name=os.getenv('AWS_REGION', 'us-east-1'))
  response = client.batch_get_secret_value(SecretIdList=[
    f'{SecretsPath}/config/dcapi',
    f'{SecretsPath}/infrastructure/index' 
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

