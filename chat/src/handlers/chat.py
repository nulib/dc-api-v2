import os
from event_config import EventConfig
from helpers.response import prepare_response


def handler(event, _context):
    try:
        config = EventConfig(event)
        socket = event.get('socket', None)
        config.setup_websocket(socket)

        if not config.is_logged_in:
            config.socket.send({"type": "error", "message": "Unauthorized"})
            return {"statusCode": 401, "body": "Unauthorized"}
        
        if config.debug_mode:
            config.socket.send(config.debug_message())

        if not os.getenv("SKIP_WEAVIATE_SETUP"):
            config.setup_llm_request()
            final_response = prepare_response(config)
            config.socket.send(final_response)
        return {"statusCode": 200}
    except Exception as err:
        raise err