from langchain_aws import ChatBedrock
from langchain_core.language_models.base import BaseModel

def chat_model(**kwargs) -> BaseModel:
    return ChatBedrock(**kwargs)