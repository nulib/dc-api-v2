import unittest
from langchain_core.messages.base import BaseMessage
from langchain_core.messages.system import SystemMessage
from langgraph.graph import END

from agent.search_agent import SearchWorkflow, SearchAgentState


class FakeMessage(BaseMessage):
    type: str = "fake"  # specify a default type
    content: str
    tool_calls: list = []


class FakeModel:
    def invoke(self, messages):
        # Just return a mock response
        return SystemMessage(content="Mock Response")


class TestSearchWorkflow(unittest.TestCase):
    def setUp(self):
        self.model = FakeModel()
        self.workflow = SearchWorkflow(
            model=self.model, system_message="Test system message"
        )

    def test_should_continue_with_tool_calls(self):
        state = SearchAgentState(messages=[
            FakeMessage(content="Hello"),
            FakeMessage(content="Calling tool", tool_calls=["test_tool"]),
        ])
        result = self.workflow.should_continue(state)
        self.assertEqual(result, "tools")

    def test_should_continue_without_tool_calls(self):
        state = SearchAgentState(messages=[
            FakeMessage(content="Hello"),
            FakeMessage(content="No tool calls here"),
        ])
        result = self.workflow.should_continue(state)
        self.assertEqual(result, END)

    def test_call_model(self):
        state = SearchAgentState(messages=[FakeMessage(content="User input")])
        result = self.workflow.call_model(state)
        self.assertIn("messages", result)
        self.assertEqual(len(result["messages"]), 1)
        self.assertEqual(result["messages"][0].content, "Mock Response")

    def test_call_model_with_facets(self):
        facets = [{"subject.label": "Nigeria"}, {"collection.title.keyword": "Test Collection"}]
        state = SearchAgentState(
            messages=[FakeMessage(content="User input")],
            facets=facets
        )
        result = self.workflow.call_model(state)
        self.assertIn("messages", result)
        self.assertEqual(len(result["messages"]), 1)
        self.assertEqual(result["messages"][0].content, "Mock Response")

    def test_create_facets_context(self):
        facets = [
            {"subject.label": ["Nigeria", "Ghana"]},
            {"collection.title.keyword": "E. H. Duckworth Photograph Collection"},
            {"work_type.keyword": "Image"}
        ]
        
        context = self.workflow._create_facets_context(facets)
        
        self.assertIn("IMPORTANT CONTEXT", context)
        self.assertIn("Subject: Nigeria, Ghana", context)
        self.assertIn("Collection.Title: E. H. Duckworth Photograph Collection", context)
        self.assertIn("Work Type: Image", context)
        self.assertIn("Do NOT attempt to broaden", context)
