from typing import Any, Dict, Optional, Union, List
from uuid import UUID
from websocket import Websocket

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.outputs import LLMResult
from langchain.schema import AgentFinish, AgentAction


class AgentHandler(BaseCallbackHandler):    
    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, metadata: Optional[dict[str, Any]], **kwargs: Any) -> Any:
        socket: Websocket = metadata.get("socket")
        if socket is None:
            raise ValueError("Socket not defined in agent handler via metadata")
        
        socket.send({"type": "tool_start", "message": serialized})
        
    def on_tool_end(self, output, **kwargs):
        print("on_tool_end output:")
        print(output)
        