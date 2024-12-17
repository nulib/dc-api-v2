from unittest import TestCase
from unittest.mock import patch
import sys

sys.path.append("./src")

from agent.agent_handler import AgentHandler
from agent.search_agent import SearchAgent
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver
from websocket import Websocket

class MockClient:
    def __init__(self):
        self.received = []
    def post_to_connection(self, Data, ConnectionId):
        self.received.append(Data)
        return Data

class TestAgentHandler(TestCase):
    @patch('agent.search_agent.checkpoint_saver', return_value=MemorySaver())
    def test_search_agent_invoke_simple(self, mock_create_saver):
        websocket_client = MockClient()
        websocket = Websocket(client=websocket_client, connection_id="test_connection_id", ref="test_ref")
        expected_response = "This is a mocked LLM response."
        chat_model = FakeListChatModel(responses=[expected_response], )
        search_agent = SearchAgent(model=chat_model, streaming=True)
        callbacks = [AgentHandler(websocket, "test_ref")]
        search_agent.invoke(question="What is the capital of France?", ref="test_ref", callbacks=callbacks)
        print(websocket_client.received)
