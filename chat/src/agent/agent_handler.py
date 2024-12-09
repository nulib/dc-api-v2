from typing import Any, Dict, Optional, Union, List
from uuid import UUID
# from websocket import Websocket

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from langchain.schema import AgentFinish, AgentAction


class AgentHandler(BaseCallbackHandler):
    def on_chat_model_start(self, serialized: Dict[str, Any], messages: List[List[BaseMessage]], *, run_id: UUID, parent_run_id: Optional[UUID] = None, tags: Optional[List[str]] = None, **kwargs: Any) -> Any:
        pass

    def add_handler(self, handler: BaseCallbackHandler, inherit: bool = True) -> None:
        pass

    def remove_handler(self, handler: BaseCallbackHandler) -> None:
        pass

    def set_handlers(self, handlers: List[BaseCallbackHandler], inherit: bool = True) -> None:
        pass

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any) -> Any:
        pass

    def on_llm_new_token(self, token: str, **kwargs: Any) -> Any:
        pass

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> Any:
        pass

    def on_llm_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> Any:
        pass

    def on_chain_start(self, serialized: Dict[str, Any], inputs: Dict[str, Any], **kwargs: Any) -> Any:
        pass

    def on_chain_end(self, outputs: Dict[str, Any], **kwargs: Any) -> Any:
        pass

    def on_chain_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> Any:
        pass

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, metadata: Optional[dict[str, Any]], **kwargs: Any) -> Any:
        print(f"on_tool_start: {serialized, input_str}")
        print(f"on_tool_start kawrgs: {kwargs}")
        # socket: Websocket = metadata.get("socket", None)

        # if socket is None:
            # raise ValueError("Socket not defined in agent handler via metadata")
        
        # socket.send(f"🎉 I'm working on it")

    def on_tool_end(self, output: str, **kwargs: Any) -> Any:
        print(f"on_tool_end: {output}")
        print(f"on_tool_end kwargs: {kwargs}")
        pass

    def on_tool_error(self, error: Union[Exception, KeyboardInterrupt], **kwargs: Any) -> Any:
        pass

    def on_text(self, text: str, **kwargs: Any) -> Any:
        pass

    def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
        print(f"on_agent_action: {action}")
        print(f"on_agent_action kwargs: {kwargs}")
        pass

    def on_agent_finish(self, finish: AgentFinish, **kwargs: Any) -> Any:
        pass


"""
on_tool_start (A tool is starting): (
{'name': 'search', 'description': "Perform a semantic search of Northwestern University Library digital collections. When answering a search query, ground your answer in the context of the results with references to the document's metadata."}, 
"{'query': 'World War II Posters visual themes'}"
)

"""