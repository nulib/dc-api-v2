from typing import Any, Dict, Optional, Union, List
from uuid import UUID
from websocket import Websocket

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from langchain.schema import AgentFinish, AgentAction


class AgentHandler(BaseCallbackHandler):
    def on_llm_new_token(self, token: str, metadata: Optional[dict[str, Any]], **kwargs: Any) -> Any:
        socket: Websocket = metadata.get("socket", None)

        if socket is None:
            raise ValueError("Socket not defined in agent handler via metadata")
        
        socket.send("test")

    # def on_tool_start(self, serialized: Dict[str, Any], input_str: str, metadata: Optional[dict[str, Any]], **kwargs: Any) -> Any:
    #     print(f"on_tool_start: {serialized, input_str}")
    #     # socket: Websocket = metadata.get("socket", None)

    #     # if socket is None:
    #         # raise ValueError("Socket not defined in agent handler via metadata")
        
    #     # socket.send(f"🎉 I'm working on it")

    # def on_tool_end(self, output: str, **kwargs: Any) -> Any:
    #     print(f"on_tool_end: {output}")
    #     pass

    # def on_text(self, text: str, **kwargs: Any) -> Any:
    #     print(f"on_text: {text}")
    #     pass

    # def on_agent_action(self, action: AgentAction, **kwargs: Any) -> Any:
    #     print(f"on_agent_action: {action}")
    #     pass
    
    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, metadata: Optional[dict[str, Any]], **kwargs: Any) -> Any:
        socket: Websocket = metadata.get("socket", None)
        if socket is None:
            raise ValueError("Socket not defined in agent handler via metadata")
        
        socket.send(f"🎉 I'm working on it")