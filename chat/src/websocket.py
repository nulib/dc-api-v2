import json
from setup import websocket_client

class Websocket:
    def __init__(self, client=None, endpoint_url=None, connection_id=None, ref=None):
        self.client = client or websocket_client(endpoint_url)
        self.connection_id = connection_id
        self.ref = ref if ref else {}

    def send(self, data):
        if isinstance(data, str):
            data = {"message": data}
        data["ref"] = self.ref
        data_as_bytes = bytes(json.dumps(data), "utf-8")

        if self.connection_id == "debug":
            print(data)
        else:
            self.client.post_to_connection(Data=data_as_bytes, ConnectionId=self.connection_id)
        return data

    def __str__(self):
        return f"Websocket({self.connection_id}, {self.ref})"
    
    def __repr__(self):
        return str(self)
