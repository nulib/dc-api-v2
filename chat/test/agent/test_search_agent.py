from unittest import TestCase
from unittest.mock import patch

from agent.search_agent import SearchAgent
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.checkpoint.memory import MemorySaver


class TestSearchAgent(TestCase):
    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    def test_search_agent_init(self, mock_create_saver):
        chat_model = FakeListChatModel(responses=["fake response"])
        search_agent = SearchAgent(model=chat_model, streaming=True)
        self.assertIsNotNone(search_agent)

    @patch("agent.search_agent.checkpoint_saver", return_value=MemorySaver())
    def test_search_agent_invoke_simple(self, mock_create_saver):
        expected_response = "This is a mocked LLM response."
        chat_model = FakeListChatModel(responses=[expected_response])
        search_agent = SearchAgent(model=chat_model, streaming=True)
        result = search_agent.invoke(
            question="What is the capital of France?", ref="test_ref"
        )

        self.assertIn("messages", result)
        self.assertGreater(len(result["messages"]), 0)
        self.assertEqual(result["messages"][-1].content, expected_response)

    @patch("agent.search_agent.checkpoint_saver")
    def test_search_agent_invocation(self, mock_create_saver):
        # Create a memory saver instance with a Mock for delete_checkpoints
        memory_saver = MemorySaver()
        from unittest.mock import Mock

        memory_saver.delete_checkpoints = Mock()
        mock_create_saver.return_value = memory_saver

        # Test that the SearchAgent invokes the model with the correct messages
        chat_model = FakeListChatModel(responses=["first response", "second response"])
        search_agent = SearchAgent(model=chat_model, streaming=True)

        # First invocation with some question
        result_1 = search_agent.invoke(question="First question?", ref="test_ref")
        self.assertIn("messages", result_1)
        self.assertEqual(result_1["messages"][-1].content, "first response")

        # Second invocation, same ref, should retain memory
        result_2 = search_agent.invoke(question="Second question?", ref="test_ref")
        self.assertEqual(result_2["messages"][-1].content, "second response")

        # Verify delete_checkpoints was not called
        memory_saver.delete_checkpoints.assert_not_called()

    @patch("agent.search_agent.checkpoint_saver")
    def test_search_agent_invoke_forget(self, mock_create_saver):
        # Create a memory saver instance with a Mock for delete_checkpoints
        memory_saver = MemorySaver()
        from unittest.mock import Mock

        memory_saver.delete_checkpoints = Mock()
        mock_create_saver.return_value = memory_saver

        # Test `forget=True` to ensure that state is reset and doesn't carry over between invocations
        chat_model = FakeListChatModel(responses=["first response", "second response"])
        search_agent = SearchAgent(model=chat_model, streaming=True)

        # First invocation with some question
        result_1 = search_agent.invoke(question="First question?", ref="test_ref")
        self.assertIn("messages", result_1)
        self.assertEqual(result_1["messages"][-1].content, "first response")

        # Second invocation, same ref, should retain memory if we don't forget
        result_2 = search_agent.invoke(question="Second question?", ref="test_ref")
        self.assertEqual(result_2["messages"][-1].content, "second response")

        # Now invoke with forget=True, resetting the state
        new_chat_model = FakeListChatModel(responses=["fresh response"])
        search_agent = SearchAgent(model=new_chat_model, streaming=True)

        # Forget the state for "test_ref"
        result_3 = search_agent.invoke(
            question="Third question after forgetting?", ref="test_ref", forget=True
        )
        # With a fresh FakeListChatModel, the response should now be "fresh response"
        self.assertEqual(result_3["messages"][-1].content, "fresh response")

        # Verify delete_checkpoints was called
        memory_saver.delete_checkpoints.assert_called_once_with("test_ref")
