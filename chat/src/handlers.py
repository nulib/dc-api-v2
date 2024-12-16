import boto3
import json
import logging
import os
from core.secrets import load_secrets
from datetime import datetime
from core.event_config import EventConfig
from honeybadger import honeybadger
from agent.search_agent import SearchAgent
from agent.callbacks.socket import SocketCallbackHandler
from agent.callbacks.metrics import MetricsCallbackHandler
from core.setup import chat_model

honeybadger.configure()
logging.getLogger("honeybadger").addHandler(logging.StreamHandler())

def chat_sync(event, context):
    load_secrets()
    config = EventConfig(event)

    if not config.is_logged_in:
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        return {"statusCode": 400, "body": "Question cannot be blank"}

    model = chat_model(model=config.model, streaming=False)
    search_agent = SearchAgent(model=model)
    result = MetricsCallbackHandler()
    search_agent.invoke(
        config.question, config.ref, forget=config.forget, callbacks=[result]
    )

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {
                "answer": result.answers,
                "is_dev_team": config.api_token.is_dev_team(),
                "is_superuser": config.api_token.is_superuser(),
                "k": config.k,
                "model": config.model,
                "question": config.question,
                "ref": config.ref,
                "artifacts": result.artifacts,
                "token_counts": result.accumulator,
            }
        ),
    }

def chat(event, context):
    load_secrets()
    config = EventConfig(event)
    socket = event.get("socket", None)
    config.setup_websocket(socket)

    if not (config.is_logged_in or config.is_superuser):
        config.socket.send({"type": "error", "message": "Unauthorized"})
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        config.socket.send({"type": "error", "message": "Question cannot be blank"})
        return {"statusCode": 400, "body": "Question cannot be blank"}

    metrics = MetricsCallbackHandler()
    callbacks = [SocketCallbackHandler(config.socket, config.ref), metrics]
    model = chat_model(model=config.model, streaming=config.stream_response)
    search_agent = SearchAgent(model=model)

    try:
        search_agent.invoke(config.question, config.ref, forget=config.forget, callbacks=callbacks)
        log_metrics(context, metrics, config)
    except Exception as e:
        error_response = {"type": "error", "message": "An unexpected error occurred. Please try again later."}
        if config.socket:
            config.socket.send(error_response)
        raise e

    return {"statusCode": 200}


def log_metrics(context, metrics, config):
    log_group = os.getenv("METRICS_LOG_GROUP")
    log_stream = context.log_stream_name
    if log_group and ensure_log_stream_exists(log_group, log_stream):
        client = log_client()
        log_events = [{
            "timestamp": timestamp(), 
            "message": json.dumps({
                "answer": metrics.answers,
                "is_dev_team": config.api_token.is_dev_team(),
                "is_superuser": config.api_token.is_superuser(),
                "k": config.k,
                "model": config.model,
                "question": config.question,
                "ref": config.ref,
                "artifacts": metrics.artifacts,
                "token_counts": metrics.accumulator,
            })
        }]
        client.put_log_events(
                logGroupName=log_group, logStreamName=log_stream, logEvents=log_events
            )
    
def ensure_log_stream_exists(log_group, log_stream):
    client = log_client()
    try:
        print(client.create_log_stream(logGroupName=log_group, logStreamName=log_stream))
        return True
    except client.exceptions.ResourceAlreadyExistsException:
        return True
    except Exception:
        print(f"Could not create log stream: {log_group}:{log_stream}")
        return False

def log_client():
    return boto3.client("logs", region_name=os.getenv("AWS_REGION", "us-east-1"))

def timestamp():
    return round(datetime.timestamp(datetime.now()) * 1000)
