import boto3
import json
import logging
import os
from datetime import datetime
from event_config import EventConfig
from helpers.response import Response
from honeybadger import honeybadger

honeybadger.configure()
logging.getLogger('honeybadger').addHandler(logging.StreamHandler())

RESPONSE_TYPES = {
    "base": ["answer", "ref"],
    "debug": ["answer", "attributes", "azure_endpoint", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "temperature", "text_key", "token_counts"],
    "log": ["answer", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "size", "source_documents", "temperature", "token_counts"],
    "error": ["question", "error", "source_documents"]
}

def handler(event, context):
    config = EventConfig(event)
    socket = event.get('socket', None)
    config.setup_websocket(socket)

    if not config.is_logged_in:
        config.socket.send({"type": "error", "message": "Unauthorized"})
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        config.socket.send({"type": "error", "message": "Question cannot be blank"})
        return {"statusCode": 400, "body": "Question cannot be blank"}
    
    debug_message = config.debug_message()
    if config.debug_mode:
        config.socket.send(debug_message)

    if not os.getenv("SKIP_WEAVIATE_SETUP"):
        config.setup_llm_request()
        response = Response(config)
        final_response = response.prepare_response()
        if "error" in final_response:
            logging.error(f'Error: {final_response["error"]}')
            config.socket.send({"type": "error", "message": "Internal Server Error"})
            return {"statusCode": 500, "body": "Internal Server Error"}
        else:
            config.socket.send(reshape_response(final_response, 'debug' if config.debug_mode else 'base'))

    log_group = os.getenv('METRICS_LOG_GROUP')
    log_stream = context.log_stream_name
    if log_group and ensure_log_stream_exists(log_group, log_stream):
        log_client = boto3.client('logs')
        log_message = reshape_response(final_response, 'log')
        log_events = [
            {
                'timestamp': timestamp(),
                'message': json.dumps(log_message)
            }
        ]
        log_client.put_log_events(logGroupName=log_group, logStreamName=log_stream, logEvents=log_events)
    return {"statusCode": 200}

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