import secrets # noqa
import json
import logging
import os
from http_event_config import HTTPEventConfig
from helpers.http_response import HTTPResponse
from honeybadger import honeybadger

honeybadger.configure()
logging.getLogger('honeybadger').addHandler(logging.StreamHandler())

RESPONSE_TYPES = {
    "base": ["answer", "ref", "context"],
    "debug": ["answer", "attributes", "azure_endpoint", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "temperature", "text_key", "token_counts", "context"],
    "log": ["answer", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "size", "source_documents", "temperature", "token_counts"],
    "error": ["question", "error", "source_documents"]
}

def handler(event, context):
    config = HTTPEventConfig(event)

    if not config.is_logged_in:
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        return {"statusCode": 400, "body": "Question cannot be blank"}
    
    if not os.getenv("SKIP_LLM_REQUEST"):
        config.setup_llm_request()
        response = HTTPResponse(config)
        final_response = response.prepare_response()
        if "error" in final_response:
            logging.error(f'Error: {final_response["error"]}')
            return {"statusCode": 500, "body": "Internal Server Error"} 
        else:
            return {"statusCode": 200, "body": json.dumps(reshape_response(final_response, 'debug' if config.debug_mode else 'base'))} 

    return {"statusCode": 200}

def reshape_response(response, type):
    return {k: response[k] for k in RESPONSE_TYPES[type]}