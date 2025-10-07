import json

from dataclasses import dataclass, field

from langchain_core.prompts import ChatPromptTemplate

from core.apitoken import ApiToken
from core.prompts import prompt_template
from core.websocket import Websocket
from uuid import uuid4
from typing import Optional, List

CHAIN_TYPE = "stuff"
CHAT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
DOCUMENT_VARIABLE_NAME = "context"
K_VALUE = 40
MAX_K = 100
MAX_TOKENS = 1000
SIZE = 20
TEMPERATURE = 0.2
TEXT_KEY = "id"
VERSION = "2024-02-01"


@dataclass
class EventConfig:
    """
    The EventConfig class represents the configuration for an event.
    Default values are set for the following properties which can be overridden in the payload message.
    """

    api_token: ApiToken = field(init=False)
    debug_mode: bool = field(init=False)
    docs: Optional[List[str]] = field(init=False, default=None)
    event: dict = field(default_factory=dict)
    facets: Optional[List[dict]] = field(init=False, default=None)
    forget: bool = field(init=False)
    is_dev_team: bool = field(init=False)
    is_logged_in: bool = field(init=False)
    is_institution: bool = field(init=False)
    is_superuser: bool = field(init=False)
    k: int = field(init=False)
    max_tokens: int = field(init=False)
    model: str = field(init=False)
    payload: dict = field(default_factory=dict)
    prompt_text: str = field(init=False)
    prompt: ChatPromptTemplate = field(init=False)
    question: str = field(init=False)
    ref: str = field(init=False)
    request_context: dict = field(init=False)
    temperature: float = field(init=False)
    size: int = field(init=False)
    socket: Websocket = field(init=False, default=None)
    stream_response: bool = field(init=False)
    text_key: str = field(init=False)

    def __post_init__(self):
        self.payload = json.loads(self.event.get("body", "{}"))
        self.api_token = ApiToken(signed_token=self.payload.get("auth"))
        self.debug_mode = self._is_debug_mode_enabled()
        self.docs = self.payload.get("docs", None)
        self.facets = self.payload.get("facets", None)
        self.forget = self.payload.get("forget", False)
        self.is_dev_team = self.api_token.is_dev_team()
        self.is_logged_in = self.api_token.is_logged_in()
        self.is_institution = self.api_token.is_institution()
        self.is_superuser = self.api_token.is_superuser()
        self.k = self._get_k()
        self.max_tokens = min(self.payload.get("max_tokens", MAX_TOKENS), MAX_TOKENS)
        self.model = self._get_payload_value_with_superuser_check("model", CHAT_MODEL)
        self.prompt_text = self._get_prompt_text()
        self.request_context = self.event.get("requestContext", {})
        self.question = self.payload.get("question")
        self.ref = self.payload.get("ref", uuid4().hex)
        self.size = self._get_size()
        self.stream_response = self.payload.get("stream_response", not self.debug_mode)
        self.temperature = self._get_temperature()
        self.text_key = self._get_text_key()
        self.prompt = ChatPromptTemplate.from_template(self.prompt_text)

    def user_can(self, scope):
        return self.api_token.can(scope)

    def _get_payload_value_with_superuser_check(self, key, default):
        if self.api_token.is_superuser():
            return self.payload.get(key, default)
        else:
            return default

    def _get_k(self):
        value = self._get_payload_value_with_superuser_check("k", K_VALUE)
        return min(value, MAX_K)

    def _get_prompt_text(self):
        return self._get_payload_value_with_superuser_check("prompt", prompt_template())

    def _get_size(self):
        return self._get_payload_value_with_superuser_check("size", SIZE)

    def _get_temperature(self):
        return self._get_payload_value_with_superuser_check("temperature", TEMPERATURE)

    def _get_text_key(self):
        return self._get_payload_value_with_superuser_check("text_key", TEXT_KEY)

    def setup_websocket(self, socket=None):
        if socket is None:
            connection_id = self.request_context.get("connectionId")
            endpoint_url = f"https://{self.request_context.get('domainName')}/{self.request_context.get('stage')}"
            self.socket = Websocket(
                endpoint_url=endpoint_url, connection_id=connection_id, ref=self.ref
            )
        else:
            self.socket = socket
        return self.socket

    def _is_debug_mode_enabled(self):
        debug = self.payload.get("debug", False)
        return debug and self.api_token.is_superuser()
