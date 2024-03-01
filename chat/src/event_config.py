import os
import json

from dataclasses import dataclass, field
from langchain.chains.qa_with_sources import load_qa_with_sources_chain
from langchain.prompts import PromptTemplate
from setup import (
    opensearch_client,
    opensearch_vector_store,
    openai_chat_client,
)
from typing import List
from handlers.streaming_socket_callback_handler import StreamingSocketCallbackHandler
from helpers.apitoken import ApiToken
from helpers.prompts import document_template, prompt_template
from websocket import Websocket

CHAIN_TYPE = "stuff"
DOCUMENT_VARIABLE_NAME = "context"
K_VALUE = 5
MAX_K = 100
TEMPERATURE = 0.2
TEXT_KEY = "title"
VERSION = "2023-07-01-preview"

@dataclass
class EventConfig:
    """
    The EventConfig class represents the configuration for an event.
    Default values are set for the following properties which can be overridden in the payload message.
    """

    DEFAULT_ATTRIBUTES = ["accession_number", "alternate_title", "api_link", "canonical_link", "caption", "collection", 
                          "contributor", "date_created", "date_created_edtf", "description", "genre", "id", "identifier", 
                          "keywords", "language", "notes", "physical_description_material", "physical_description_size", 
                          "provenance", "publisher", "rights_statement", "subject", "table_of_contents", "thumbnail", 
                          "title", "visibility", "work_type"]

    api_token: ApiToken = field(init=False)
    attributes: List[str] = field(init=False)
    azure_endpoint: str = field(init=False)
    azure_resource_name: str = field(init=False)
    debug_mode: bool = field(init=False)
    deployment_name: str = field(init=False)
    document_prompt: PromptTemplate = field(init=False)
    event: dict = field(default_factory=dict)
    is_logged_in: bool = field(init=False)
    k: int = field(init=False)
    openai_api_version: str = field(init=False)
    payload: dict = field(default_factory=dict)
    prompt_text: str = field(init=False)
    prompt: PromptTemplate = field(init=False)
    question: str = field(init=False)
    ref: str = field(init=False)
    request_context: dict = field(init=False)
    temperature: float = field(init=False)
    socket: Websocket = field(init=False, default=None)
    text_key: str = field(init=False)

    def __post_init__(self):
        self.payload = json.loads(self.event.get("body", "{}"))
        self.api_token = ApiToken(signed_token=self.payload.get("auth"))
        self.attributes = self._get_attributes()
        self.azure_endpoint = self._get_azure_endpoint()
        self.azure_resource_name = self._get_azure_resource_name()
        self.debug_mode = self._is_debug_mode_enabled()
        self.deployment_name = self._get_deployment_name()
        self.is_logged_in = self.api_token.is_logged_in()
        self.k = self._get_k()
        self.openai_api_version = self._get_openai_api_version()
        self.prompt_text = self._get_prompt_text()
        self.request_context = self.event.get("requestContext", {})
        self.question = self.payload.get("question")
        self.ref = self.payload.get("ref")
        self.temperature = self._get_temperature()
        self.text_key = self._get_text_key()
        self.document_prompt = self._get_document_prompt()
        self.prompt = PromptTemplate(
            template=self.prompt_text, input_variables=["question", "context"]
        )

    def _get_payload_value_with_superuser_check(self, key, default):
        if self.api_token.is_superuser():
            return self.payload.get(key, default)
        else:
            return default

    def _get_attributes_function(self):
        try:
            opensearch = opensearch_client()
            mapping = opensearch.indices.get_mapping(index="dc-v2-work")
            return list(next(iter(mapping.values()))['mappings']['properties'].keys())
        except StopIteration:
            return []

    def _get_attributes(self):
        return self._get_payload_value_with_superuser_check("attributes", self.DEFAULT_ATTRIBUTES)

    def _get_azure_endpoint(self):
        default = f"https://{self._get_azure_resource_name()}.openai.azure.com/"
        return self._get_payload_value_with_superuser_check("azure_endpoint", default)

    def _get_azure_resource_name(self):
        azure_resource_name = self._get_payload_value_with_superuser_check(
            "azure_resource_name", os.environ.get("AZURE_OPENAI_RESOURCE_NAME")
        )
        if not azure_resource_name:
            raise EnvironmentError(
                "Either payload must contain 'azure_resource_name' or environment variable 'AZURE_OPENAI_RESOURCE_NAME' must be set"
            )
        return azure_resource_name

    def _get_deployment_name(self):
        return self._get_payload_value_with_superuser_check(
            "deployment_name", os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT_ID")
        )

    def _get_k(self):
        value = self._get_payload_value_with_superuser_check("k", K_VALUE)
        return min(value, MAX_K)

    def _get_openai_api_version(self):
        return self._get_payload_value_with_superuser_check(
            "openai_api_version", VERSION
        )

    def _get_prompt_text(self):
        return self._get_payload_value_with_superuser_check("prompt", prompt_template())

    def _get_temperature(self):
        return self._get_payload_value_with_superuser_check("temperature", TEMPERATURE)

    def _get_text_key(self):
        return self._get_payload_value_with_superuser_check("text_key", TEXT_KEY)

    def _get_document_prompt(self):
        return PromptTemplate(
            template=document_template(self.attributes),
            input_variables=["title", "id"] + self.attributes,
        )

    def debug_message(self):
        return {
            "type": "debug",
            "message": {
                "attributes": self.attributes,
                "azure_endpoint": self.azure_endpoint,
                "deployment_name": self.deployment_name,
                "k": self.k,
                "openai_api_version": self.openai_api_version,
                "prompt": self.prompt_text,
                "question": self.question,
                "ref": self.ref,
                "temperature": self.temperature,
                "text_key": self.text_key,
            },
        }

    def setup_websocket(self, socket=None):
        if socket is None:
            connection_id = self.request_context.get("connectionId")
            endpoint_url = f'https://{self.request_context.get("domainName")}/{self.request_context.get("stage")}'
            self.socket = Websocket(
                endpoint_url=endpoint_url, connection_id=connection_id, ref=self.ref
            )
        else:
            self.socket = socket
        return self.socket

    def setup_llm_request(self):
        self._setup_vector_store()
        self._setup_chat_client()
        self._setup_chain()

    def _setup_vector_store(self):
        self.opensearch = opensearch_vector_store()

    def _setup_chat_client(self):
        self.client = openai_chat_client(
            deployment_name=self.deployment_name,
            openai_api_base=self.azure_endpoint,
            openai_api_version=self.openai_api_version,
            callbacks=[StreamingSocketCallbackHandler(self.socket, self.debug_mode)],
            streaming=True,
        )

    def _setup_chain(self):
        self.chain = load_qa_with_sources_chain(
            self.client,
            chain_type=CHAIN_TYPE,
            prompt=self.prompt,
            document_prompt=self.document_prompt,
            document_variable_name=DOCUMENT_VARIABLE_NAME,
            verbose=self._to_bool(os.getenv("VERBOSE")),
        )

    def _is_debug_mode_enabled(self):
        debug = self.payload.get("debug", False)
        return debug and self.api_token.is_superuser()

    def _to_bool(self, val):
        """Converts a value to boolean. If the value is a string, it considers
        "", "no", "false", "0" as False. Otherwise, it returns the boolean of the value.
        """
        if isinstance(val, str):
            return val.lower() not in ["", "no", "false", "0"]
        return bool(val)
