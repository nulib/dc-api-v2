import secrets # noqa
import boto3
import logging
import os
from datetime import datetime
from event_config import EventConfig
from honeybadger import honeybadger
from chat.src.agent.search_agent import search_agent

honeybadger.configure()
logging.getLogger('honeybadger').addHandler(logging.StreamHandler())

RESPONSE_TYPES = {
    "base": ["answer", "ref"],
    "debug": ["answer", "attributes", "azure_endpoint", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "temperature", "text_key", "token_counts"],
    "log": ["answer", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "size", "source_documents", "temperature", "token_counts", "is_dev_team"],
    "error": ["question", "error", "source_documents"]
}

def handler(event, context):
    config = EventConfig(event)
    socket = event.get('socket', None)
    config.setup_websocket(socket)

    if not (config.is_logged_in or config.is_superuser):
        config.socket.send({"type": "error", "message": "Unauthorized"})
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        config.socket.send({"type": "error", "message": "Question cannot be blank"})
        return {"statusCode": 400, "body": "Question cannot be blank"}


    

def reshape_response(response, type):
    return {k: response[k] for k in RESPONSE_TYPES[type]}

def ensure_log_stream_exists(log_group, log_stream):
    log_client = boto3.client('logs')
    try:
        log_client.create_log_stream(logGroupName=log_group, logStreamName=log_stream)
        return True
    except log_client.exceptions.ResourceAlreadyExistsException:
        return True
    except Exception:
        print(f'Could not create log stream: {log_group}:{log_stream}')
        return False

def timestamp():
    return round(datetime.timestamp(datetime.now()) * 1000)