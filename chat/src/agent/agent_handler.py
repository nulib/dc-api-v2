from typing import Any, Dict, List, Optional

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

    def on_llm_start(self, serialized: dict[str, Any], prompts: list[str], metadata: Optional[dict[str, Any]] = None, **kwargs: Dict[str, Any]):
        self.socket.send({"type": "start", "ref": self.ref, "message": {"model": metadata.get("ls_model_name")}})

    def on_llm_end(self, response: LLMResult, **kwargs: Dict[str, Any]):
        response_generation = response.generations[0][0]
        content = response_generation.text
        stop_reason = response_generation.message.response_metadata.get("stop_reason", "unknown")
        if content != "":
            self.socket.send({"type": "stop", "ref": self.ref})
            self.socket.send({"type": "answer", "ref": self.ref, "message": content})
        if stop_reason == "end_turn":
            self.socket.send({"type": "final_message", "ref": self.ref})
            
        
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
                    result_fields = ("id", "title", "visibility", "work_type", "thumbnail")
                    docs: List[Dict[str, Any]] = [{k: doc.metadata.get(k) for k in result_fields} for doc in output.artifact]
                    self.socket.send({"type": "search_result", "ref": self.ref, "message": docs})
                except json.decoder.JSONDecodeError as e:
                    print(f"Invalid json ({e}) returned from {output.name} tool: {output.content}")
            case _:
                print(f"Unhandled tool_end message: {output}")

    def on_agent_finish(self, finish, **kwargs):
        self.socket.send({"type": "final", "ref": self.ref, "message": "Finished"})
