from langchain_aws import ChatBedrock
from langchain_core.language_models.base import BaseModel

MODEL_OVERRIDE: BaseModel = None

def chat_model(**kwargs):
    return MODEL_OVERRIDE or ChatBedrock(**kwargs)

def set_model_override(model: BaseModel):
    global MODEL_OVERRIDE
    MODEL_OVERRIDE = model