import boto3
import json
import os
from datetime import datetime
from event_config import EventConfig
from helpers.response import prepare_response
from honeybadger import honeybadger

if not os.getenv("HONEYBADGER_DISABLED") == "true":
    honeybadger.configure()

RESPONSE_TYPES = {
    "base": ["answer", "ref"],
    "debug": ["answer", "attributes", "azure_endpoint", "deployment_name", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "temperature", "text_key", "token_counts"],
    "log": ["answer", "is_superuser", "k", "openai_api_version", "prompt", "question", "ref", "temperature", "token_counts"]
}

def handler(event, context):
    config = EventConfig(event)
    socket = event.get('socket', None)
    config.setup_websocket(socket)

    if not config.is_logged_in:
        config.socket.send({"type": "error", "message": "Unauthorized"})
        return {"statusCode": 401, "body": "Unauthorized"}
    
    debug_message = config.debug_message()
    if config.debug_mode:
        config.socket.send(debug_message)

    if not os.getenv("SKIP_WEAVIATE_SETUP"):
        config.setup_llm_request()
        final_response = prepare_response(config)
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