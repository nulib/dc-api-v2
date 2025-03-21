import json
import logging
from core.secrets import load_secrets
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

    log_info = {
        "is_dev_team": config.api_token.is_dev_team(),
        "is_superuser": config.api_token.is_superuser(),
        "k": config.k,
        "model": config.model,
        "question": config.question,
        "ref": config.ref,
    }
    metrics = MetricsCallbackHandler(context.log_stream_name, extra_data=log_info)
    callbacks = [SocketCallbackHandler(config.socket, config.ref), metrics]
    model = chat_model(model=config.model, streaming=config.stream_response)
    search_agent = SearchAgent(model=model, metrics=metrics)
    
    try:
        search_agent.invoke(config.question, config.ref, forget=config.forget, docs=config.docs, callbacks=callbacks)
        metrics.log_metrics()
    except Exception as e:
        error_response = {"type": "error", "message": "An unexpected error occurred. Please try again later."}
        if config.socket:
            config.socket.send(error_response)
        raise e

    return {"statusCode": 200}
