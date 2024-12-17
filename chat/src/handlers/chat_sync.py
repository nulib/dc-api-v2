import secrets # noqa
import json
import logging
from agent.metrics_handler import MetricsHandler
from agent.search_agent import SearchAgent
from handlers.model import chat_model
from event_config import EventConfig
from honeybadger import honeybadger

honeybadger.configure()
logging.getLogger('honeybadger').addHandler(logging.StreamHandler())

def handler(event, context):
    config = EventConfig(event)

    if not config.is_logged_in:
        return {"statusCode": 401, "body": "Unauthorized"}

    if config.question is None or config.question == "":
        return {"statusCode": 400, "body": "Question cannot be blank"}

    model = chat_model(model=config.model, streaming=False)
    search_agent = SearchAgent(model=model)
    result = MetricsHandler()
    search_agent.invoke(config.question, config.ref, forget=config.forget, callbacks=[result])

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "answer": result.answers,
            "is_dev_team": config.api_token.is_dev_team(),
            "is_superuser": config.api_token.is_superuser(),
            "k": config.k,
            "model": config.model,
            "question": config.question,
            "ref": config.ref,
            "artifacts": result.artifacts,
            "token_counts": result.accumulator,
        })
    }
