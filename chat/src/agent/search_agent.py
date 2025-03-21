from typing import Literal, List
from langchain_aws import ChatBedrock
from langchain_core.messages import HumanMessage, ToolMessage
from agent.tools import aggregate, discover_fields, search, retrieve_documents
from langchain_core.messages.base import BaseMessage
from langchain_core.language_models.chat_models import BaseModel
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages.system import SystemMessage
from langgraph.graph import END, START, StateGraph, MessagesState
from langgraph.prebuilt import ToolNode
from langgraph.errors import GraphRecursionError
from core.setup import checkpoint_saver
from agent.callbacks.socket import SocketCallbackHandler
from typing import Optional
import time

DEFAULT_SYSTEM_MESSAGE = """
Please provide a brief answer to the question using the tools provided. Include specific details from multiple documents that 
support your answer. Answer in raw markdown, but not within a code block. When citing source documents, construct Markdown 
links using the document's canonical_link field. Do not include intermediate messages explaining your process. If the user's
question is unclear, ask for clarification.
"""

MAX_RECURSION_LIMIT = 16

class SearchWorkflow:
    def __init__(self, model: BaseModel, system_message: str, metrics = None):
        self.metrics = metrics
        self.model = model
        self.summarization_model = ChatBedrock(model="us.anthropic.claude-3-5-sonnet-20241022-v2:0", streaming=False)
        self.system_message = system_message

    def should_continue(self, state: MessagesState) -> Literal["tools", END]:
        messages = state["messages"]
        last_message = messages[-1]
        # If the LLM makes a tool call, then we route to the "tools" node
        if last_message.tool_calls:
            return "tools"
        # Otherwise, we stop (reply to the user)
        return END

    def summarize(self, state: MessagesState):
        messages = state["messages"]
        question = messages[0].content
        last_message = messages[-1]
        if last_message.name not in ["search", "retrieve_documents"]:
            return {"messages": messages}
        
        summary_prompt = f"""
        Summarize the following content. Return ONLY a valid JSON list where each 
        document is replaced with a new dict with the `id`, `title`, `canonical_link`, 
        and `api_link` fields, as well as any other information from the original that 
        might be useful in answering questions. Flatten any nested structures to retain 
        only semantically useful information (e.g., [{{'id': id1, 'label': label1}}, 
        {{'id': id2, 'label': label2}}, {{'id': id3, 'label': label3}}] becomes 
        [label1, label2, label3]). Be judicious about what information is retained, 
        but keep enough to answer the question "{question}" and any likely followups.

        It is extremely important that you return only the valid, parsable summarized 
        JSON with no additional text or explanation, no markdown code fencing, and all 
        unnecessary whitespace removed.
        
        Prioritize speed over comprehensiveness.

        {last_message.content}
        """

        config = {
            "callbacks": [self.metrics] if self.metrics else [], 
            "metadata": {"source": "summarize"}
        }
        
        start_time = time.time()
        
        summary = self.summarization_model.invoke([HumanMessage(content=summary_prompt)], config=config)
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f'Condensed {len(last_message.content)} bytes to {len(summary.content)} bytes in {elapsed_time:.2f} seconds')
        
        last_message.content = summary.content

        return {"messages": messages}
        
    def call_model(self, state: MessagesState):
        messages = [SystemMessage(content=self.system_message)] + state["messages"]
        response: BaseMessage = self.model.invoke(messages)
        # We return a list, because this will get added to the existing list
        return {"messages": [response]}

class SearchAgent:
    def __init__(
        self,
        model: BaseModel,
        *,
        metrics = None,
        system_message: str = DEFAULT_SYSTEM_MESSAGE,
        **kwargs
    ):
        tools = [discover_fields, search, aggregate, retrieve_documents]
        tool_node = ToolNode(tools)

        try:
            model = model.bind_tools(tools)
        except NotImplementedError:
            pass

        self.workflow_logic = SearchWorkflow(model=model, system_message=system_message, metrics=metrics)

        # Define a new graph
        workflow = StateGraph(MessagesState)

        # Define the two nodes we will cycle between
        workflow.add_node("agent", self.workflow_logic.call_model)
        workflow.add_node("tools", tool_node)
        workflow.add_node("summarize", self.workflow_logic.summarize)
        
        # Set the entrypoint as `agent`
        workflow.add_edge(START, "agent")

        # Add a conditional edge
        workflow.add_conditional_edges("agent", self.workflow_logic.should_continue)

        # Add a normal edge from `tools` to `agent`
        #workflow.add_edge("tools", "agent")
        workflow.add_edge("tools", "summarize")
        workflow.add_edge("summarize", "agent")

        self.checkpointer = checkpoint_saver()
        self.search_agent = workflow.compile(checkpointer=self.checkpointer)
    
    def invoke(self, question: str, ref: str, *, docs: Optional[List[str]] = None,
callbacks: List[BaseCallbackHandler] = [], forget: bool = False, **kwargs):
        if forget:
            self.checkpointer.delete_checkpoints(ref)

        # If documents are provided, skip the search tools and use these docs directly
        if docs and len(docs) > 0:
            # Limit to 20 documents
            docs = docs[:20]
            # Pass documents in as context for the model
            doc_lines = [str(doc) for doc in docs]
            return self.search_agent.invoke(
                {"messages": [HumanMessage(content=question + "\n" + "\n".join(doc_lines))]},
                config={
                    "configurable": {"thread_id": ref}, 
                    "callbacks": callbacks},
                **kwargs
            )
        else:  
            try:
                return self.search_agent.invoke(
                    {"messages": [HumanMessage(content=question)]},
                    config={
                        "configurable": {"thread_id": ref},
                        "callbacks": callbacks,
                        "recursion_limit": MAX_RECURSION_LIMIT,
                    },
                    **kwargs
                )
            except GraphRecursionError as e:
                print(f"Recursion error: {e}")

                # Retrieve the messages processed so far
                checkpoint_tuple = self.checkpointer.get_tuple({"configurable": {"thread_id": ref}})
                state = checkpoint_tuple.checkpoint if checkpoint_tuple else None
                messages = state.get("channel_values", {}).get("messages", []) if state else []

                # Extract relevant responses including tool outputs
                responses = []
                for msg in messages:
                    if isinstance(msg, (BaseMessage, ToolMessage)):
                        responses.append(msg.content)

                if responses:
                    # Summarize the responses so far
                    summary_prompt = f"""
                    The following is what I have discovered so far based on multiple sources. 
                    Summarize the key points concisely for the user:
                    
                    {responses[-5:]}  # Take the last few responses
                    """
                
                    # Generate a summary using the LLM
                    summary = self.workflow_logic.model.invoke([HumanMessage(content=summary_prompt)])
                    summary_text = summary.content

                    # Send summary as an "answer" message before finalizing
                    for cb in callbacks:
                        if isinstance(cb, SocketCallbackHandler):
                            cb.socket.send({"type": "answer", "ref": ref, "message": summary_text})

                else:
                    # Send a fallback message
                    fallback_message = "I reached my recursion limit but couldn't retrieve enough useful information."
                    for cb in callbacks:
                        if isinstance(cb, SocketCallbackHandler):
                            cb.socket.send({"type": "answer", "ref": ref, "message": fallback_message})
                
                for cb in callbacks:
                    if hasattr(cb, "on_agent_finish"):
                        cb.on_agent_finish(finish=None, run_id=ref, **kwargs)
                return {"type": "final", "ref": ref, "message": "Finished"}
