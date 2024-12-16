from event_config import EventConfig
from langchain_aws import ChatBedrock
from langchain_core.language_models.base import BaseModel

MODEL_OVERRIDE: BaseModel = None

def chat_model(event: EventConfig):
    return MODEL_OVERRIDE or ChatBedrock(model=event.model)

def set_model_override(model: BaseModel):
    global MODEL_OVERRIDE
    MODEL_OVERRIDE = model