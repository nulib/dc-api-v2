from typing import Any, Dict, List

from websocket import Websocket

from json.decoder import JSONDecodeError
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages.tool import ToolMessage
from langchain_core.outputs import LLMResult

import ast
import json

def deserialize_input(input_str):
    try:
        return ast.literal_eval(input_str)
    except (ValueError, SyntaxError):
        try:
            return json.loads(input_str)
        except JSONDecodeError:
            return input_str
    
class AgentHandler(BaseCallbackHandler):
    def __init__(self, socket: Websocket, ref: str, *args: List[Any], **kwargs: Dict[str, Any]):
        if socket is None:
            raise ValueError("Socket not provided to agent callback handler")
        self.socket = socket
        self.ref = ref
        super().__init__(*args, **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs: Dict[str, Any]):
        content = response.generations[0][0].text
        if content != "":
            self.socket.send({"type": "stop", "ref": self.ref})
            self.socket.send({"type": "answer", "ref": self.ref, "message": content})
        
    def on_llm_new_token(self, token: str, **kwargs: Dict[str, Any]):
        if token != "":
            self.socket.send({"type": "token", "ref": self.ref, "message": token})

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Dict[str, Any]) -> Any:
        input = deserialize_input(input_str)
        self.socket.send({"type": "tool_start", "ref": self.ref, "message": {"tool": serialized.get("name"), "input": input}})
        
    def on_tool_end(self, output: ToolMessage, **kwargs: Dict[str, Any]):
        match output.name:
            case "aggregate":
                self.socket.send({"type": "aggregation_result", "ref": self.ref, "message": output.artifact.get("aggregation_result", {})})
            case "discover_fields":
                pass
            case "search":
                try:
                    docs: List[Dict[str, Any]] = [doc.metadata for doc in output.artifact]
                    self.socket.send({"type": "source_documents", "ref": self.ref, "message": docs})
                except json.decoder.JSONDecodeError as e:
                    print(f"Invalid json ({e}) returned from {output.name} tool: {output.content}")
            case _:
                print(f"Unhandled tool_end message: {output}")
