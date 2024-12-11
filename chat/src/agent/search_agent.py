import os

from typing import Literal

from agent.dynamodb_saver import DynamoDBSaver
from agent.tools import search, aggregate
from langchain_core.messages.base import BaseMessage
from langgraph.graph import END, START, StateGraph, MessagesState
from langgraph.prebuilt import ToolNode
from setup import openai_chat_client

tools = [search, aggregate]

tool_node = ToolNode(tools)

model = openai_chat_client(streaming=True).bind_tools(tools)

# Define the function that determines whether to continue or not
def should_continue(state: MessagesState) -> Literal["tools", END]:
    messages = state["messages"]
    last_message = messages[-1]
    # If the LLM makes a tool call, then we route to the "tools" node
    if last_message.tool_calls:
        return "tools"
    # Otherwise, we stop (reply to the user)
    return END


# Define the function that calls the model
def call_model(state: MessagesState):
    messages = state["messages"]
    response: BaseMessage = model.invoke(messages, model=os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT_ID"))
    # We return a list, because this will get added to the existing list
    # if socket is not none and the response content is not an empty string
    return {"messages": [response]}


# Define a new graph
workflow = StateGraph(MessagesState)

# Define the two nodes we will cycle between
workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)

# Set the entrypoint as `agent`
workflow.add_edge(START, "agent")

# Add a conditional edge
workflow.add_conditional_edges(
    "agent",
    should_continue,
)

# Add a normal edge from `tools` to `agent`
workflow.add_edge("tools", "agent")

checkpointer = DynamoDBSaver(os.getenv("CHECKPOINT_TABLE"), os.getenv("CHECKPOINT_WRITES_TABLE"), os.getenv("AWS_REGION", "us-east-1"))

search_agent = workflow.compile(checkpointer=checkpointer)
