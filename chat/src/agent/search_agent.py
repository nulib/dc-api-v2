import os

from typing import Literal, List

from agent.s3_saver import S3Saver, delete_checkpoints
from agent.tools import aggregate, discover_fields, search
from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage
from langchain_core.messages.base import BaseMessage
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages.system import SystemMessage
from langgraph.graph import END, START, StateGraph, MessagesState
from langgraph.prebuilt import ToolNode

DEFAULT_SYSTEM_MESSAGE = """
Please provide a brief answer to the question using the tools provided. Include specific details from multiple documents that 
support your answer. Answer in raw markdown, but not within a code block. When citing source documents, construct Markdown 
links using the document's canonical_link field. Do not include intermediate messages explaining your process.
"""

class SearchAgent:
    def __init__(
        self,
        *,
        checkpoint_bucket: str = os.getenv("CHECKPOINT_BUCKET_NAME"),
        system_message: str = DEFAULT_SYSTEM_MESSAGE,
        **kwargs):

        self.checkpoint_bucket = checkpoint_bucket

        tools = [discover_fields, search, aggregate]
        tool_node = ToolNode(tools)
        model = ChatBedrock(**kwargs).bind_tools(tools)

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
            messages = [SystemMessage(content=system_message)] + state["messages"]
            response: BaseMessage = model.invoke(messages) # , model=os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT_ID")
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
        workflow.add_conditional_edges("agent", should_continue)

        # Add a normal edge from `tools` to `agent`
        workflow.add_edge("tools", "agent")

        checkpointer = S3Saver(bucket_name=checkpoint_bucket, compression="gzip")
        self.search_agent = workflow.compile(checkpointer=checkpointer)
    
    def invoke(self, question: str, ref: str, *, callbacks: List[BaseCallbackHandler] = [], forget: bool = False, **kwargs):
        if forget:
            delete_checkpoints(self.checkpoint_bucket, ref)

        return self.search_agent.invoke(
            {"messages": [HumanMessage(content=question)]},
            config={"configurable": {"thread_id": ref}, "callbacks": callbacks},
            **kwargs
        )
