from langchain.callbacks.base import BaseCallbackHandler
from websocket import Websocket

class StreamingSocketCallbackHandler(BaseCallbackHandler):
    def __init__(self, socket: Websocket, debug_mode: bool):
        self.socket = socket
        self.debug_mode = debug_mode

    def on_llm_new_token(self, token: str, **kwargs):
        if self.socket and not self.debug_mode:
            return self.socket.send({"token": token})
