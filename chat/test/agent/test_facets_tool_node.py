from unittest import TestCase
from unittest.mock import MagicMock, patch
from langchain_core.messages import AIMessage
from langgraph.graph import MessagesState
from langchain_core.tools import tool

from agent.search_agent import FacetsToolNode


@tool
def search(query: str, facets: list = None):
    """Mock search tool."""
    pass


@tool
def aggregate(agg_field: str, term_field: str, term: str, facets: list = None):
    """Mock aggregate tool."""
    pass


class TestFacetsToolNode(TestCase):
    def setUp(self):
        self.mock_tools = [search, aggregate]
        self.test_facets = [
            {"subject.label": "Nigeria"},
            {"collection.title.keyword": "E. H. Duckworth Photograph Collection"},
        ]

    def test_set_facets(self):
        facets_tool_node = FacetsToolNode(self.mock_tools, self.test_facets)
        new_facets = [{"genre.label": "Photography"}]
        facets_tool_node.set_facets(new_facets)
        self.assertEqual(facets_tool_node.facets, new_facets)

    @patch("agent.search_agent.ToolNode")
    def test_inject_facets_into_search_tool(self, mock_tool_node_class):
        mock_tool_node_instance = MagicMock()
        mock_tool_node_class.return_value = mock_tool_node_instance
        mock_tool_node_instance.invoke.return_value = {"messages": []}

        facets_tool_node = FacetsToolNode(self.mock_tools, self.test_facets)

        tool_calls = [
            {"name": "search", "args": {"query": "test query"}, "id": "call_123"}
        ]
        ai_message = AIMessage(content="", tool_calls=tool_calls)
        state = MessagesState(messages=[ai_message])

        facets_tool_node(state)

        modified_tool_calls = state["messages"][-1].tool_calls
        self.assertEqual(modified_tool_calls[0]["args"]["facets"], self.test_facets)
        mock_tool_node_instance.invoke.assert_called_once_with(state)

    @patch("agent.search_agent.ToolNode")
    def test_inject_facets_into_aggregate_tool(self, mock_tool_node_class):
        mock_tool_node_instance = MagicMock()
        mock_tool_node_class.return_value = mock_tool_node_instance
        mock_tool_node_instance.invoke.return_value = {"messages": []}

        facets_tool_node = FacetsToolNode(self.mock_tools, self.test_facets)

        tool_calls = [
            {
                "name": "aggregate",
                "args": {"agg_field": "subject.label", "term_field": "", "term": ""},
                "id": "call_456",
            }
        ]
        ai_message = AIMessage(content="", tool_calls=tool_calls)
        state = MessagesState(messages=[ai_message])

        facets_tool_node(state)

        modified_tool_calls = state["messages"][-1].tool_calls
        self.assertEqual(modified_tool_calls[0]["args"]["facets"], self.test_facets)

    @patch("agent.search_agent.ToolNode")
    def test_preserve_existing_facets_if_present(self, mock_tool_node_class):
        mock_tool_node_instance = MagicMock()
        mock_tool_node_class.return_value = mock_tool_node_instance
        mock_tool_node_instance.invoke.return_value = {"messages": []}

        facets_tool_node = FacetsToolNode(self.mock_tools, self.test_facets)

        existing_facets = [{"genre.label": "Maps"}]
        tool_calls = [
            {
                "name": "search",
                "args": {"query": "test query", "facets": existing_facets},
                "id": "call_789",
            }
        ]
        ai_message = AIMessage(content="", tool_calls=tool_calls)
        state = MessagesState(messages=[ai_message])

        facets_tool_node(state)

        modified_tool_calls = state["messages"][-1].tool_calls
        self.assertEqual(modified_tool_calls[0]["args"]["facets"], existing_facets)

    @patch("agent.search_agent.ToolNode")
    def test_no_facets_available(self, mock_tool_node_class):
        mock_tool_node_instance = MagicMock()
        mock_tool_node_class.return_value = mock_tool_node_instance
        mock_tool_node_instance.invoke.return_value = {"messages": []}

        facets_tool_node = FacetsToolNode(self.mock_tools, None)

        tool_calls = [
            {"name": "search", "args": {"query": "test query"}, "id": "call_000"}
        ]
        ai_message = AIMessage(content="", tool_calls=tool_calls)
        state = MessagesState(messages=[ai_message])

        facets_tool_node(state)

        modified_tool_calls = state["messages"][-1].tool_calls
        self.assertNotIn("facets", modified_tool_calls[0]["args"])
