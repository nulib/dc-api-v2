from typing import Any, Optional, Tuple

import base64
import bz2
import gzip
import json
import langchain_core.messages as langchain_messages
from langchain_core.messages import BaseMessage
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer


class CompressibleJsonSerializer(JsonPlusSerializer):
    def __init__(self, compression: Optional[str] = None):
        self.compression = compression

    def dumps_typed(self, obj: Any) -> Tuple[str, Any]:
        def default(o):
            if isinstance(o, BaseMessage):
                return {
                    "__type__": o.__class__.__name__,
                    "data": o.model_dump(),
                }
            raise TypeError(
                f"Object of type {o.__class__.__name__} is not JSON serializable"
            )

        json_str = json.dumps(obj, default=default)

        if self.compression is None:
            return "json", json_str
        elif self.compression == "bz2":
            compressed_str = base64.b64encode(
                bz2.compress(json_str.encode("utf-8"))
            ).decode("utf-8")
            return "bz2_json", compressed_str
        elif self.compression == "gzip":
            compressed_str = base64.b64encode(
                gzip.compress(json_str.encode("utf-8"))
            ).decode("utf-8")
            return "gzip_json", compressed_str
        else:
            raise ValueError(f"Unsupported compression type: {self.compression}")

    def loads_typed(self, data: Tuple[str, Any]) -> Any:
        type_, payload = data

        if type_ == "json":
            json_str = payload
        elif type_ == "bz2_json":
            json_str = bz2.decompress(base64.b64decode(payload)).decode("utf-8")
        elif type_ == "gzip_json":
            json_str = gzip.decompress(base64.b64decode(payload)).decode("utf-8")
        else:
            raise ValueError(f"Unknown data type: {type_}")

        def object_hook(dct):
            if "__type__" in dct:
                type_name = dct["__type__"]
                data = dct["data"]
                cls = getattr(langchain_messages, type_name, None)
                if cls and issubclass(cls, BaseMessage):
                    return cls.model_construct(**data)
                else:
                    raise ValueError(f"Unknown type: {type_name}")
            return dct

        obj = json.loads(json_str, object_hook=object_hook)
        return obj
