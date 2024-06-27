from langchain.callbacks.base import BaseCallbackHandler
from websocket import Websocket
from typing import Any
from langchain_core.outputs.llm_result import LLMResult

class StreamingSocketCallbackHandler(BaseCallbackHandler):
    def __init__(self, socket: Websocket, stream: bool = True):
        self.socket = socket
        self.stream = stream

    def on_llm_new_token(self, token: str, **kwargs):
        if len(token) > 0 and self.socket and self.stream:
            return self.socket.send({"token": token})

    def on_llm_end(self, response: LLMResult, **kwargs: Any):
        try:
            finish_reason = response.generations[0][0].generation_info["finish_reason"]
            if self.socket:
                return self.socket.send({"end": {"reason": finish_reason}})
        except Exception as err:
            finish_reason = f'Unknown ({str(err)})'
        print(f"Stream ended: {finish_reason}")
