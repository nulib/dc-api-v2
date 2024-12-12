import boto3
import json
import base64
import bz2
import gzip
import time
from typing import Any, Dict, Iterator, Optional, Sequence, Tuple, List
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import BaseMessage
import langchain_core.messages as langchain_messages

from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    PendingWrite,
    get_checkpoint_id,
)
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer as BaseJsonPlusSerializer


class JsonPlusSerializer(BaseJsonPlusSerializer):
    def __init__(self, compression: Optional[str] = None):
        self.compression = compression

    def dumps_typed(self, obj: Any) -> Tuple[str, Any]:
        def default(o):
            if isinstance(o, BaseMessage):
                return {
                    '__type__': o.__class__.__name__,
                    'data': o.model_dump(),
                }
            raise TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')

        json_str = json.dumps(obj, default=default)

        if self.compression is None:
            return 'json', json_str
        elif self.compression == 'bz2':
            compressed_str = base64.b64encode(bz2.compress(json_str.encode("utf-8"))).decode("utf-8")
            return 'bz2_json', compressed_str
        elif self.compression == 'gzip':
            compressed_str = base64.b64encode(gzip.compress(json_str.encode("utf-8"))).decode("utf-8")
            return 'gzip_json', compressed_str
        else:
            raise ValueError(f"Unsupported compression type: {self.compression}")

    def loads_typed(self, data: Tuple[str, Any]) -> Any:
        type_, payload = data

        if type_ == 'json':
            json_str = payload
        elif type_ == 'bz2_json':
            json_str = bz2.decompress(base64.b64decode(payload)).decode("utf-8")
        elif type_ == 'gzip_json':
            json_str = gzip.decompress(base64.b64decode(payload)).decode("utf-8")
        else:
            raise ValueError(f'Unknown data type: {type_}')

        def object_hook(dct):
            if '__type__' in dct:
                type_name = dct['__type__']
                data = dct['data']
                cls = getattr(langchain_messages, type_name, None)
                if cls and issubclass(cls, BaseMessage):
                    return cls.model_construct(**data)
                else:
                    raise ValueError(f'Unknown type: {type_name}')
            return dct

        obj = json.loads(json_str, object_hook=object_hook)
        return obj


def _make_s3_checkpoint_key(thread_id: str, checkpoint_ns: str, checkpoint_id: str) -> str:
    return f"checkpoints/{thread_id}/{checkpoint_ns}/{checkpoint_id}.json"

def _make_s3_write_key(thread_id: str, checkpoint_ns: str, checkpoint_id: str, task_id: str, idx: int) -> str:
    return f"checkpoints/{thread_id}/{checkpoint_ns}/{checkpoint_id}/writes/{task_id}/{idx}.json"

def _parse_s3_checkpoint_key(key: str) -> Dict[str, str]:
    parts = key.split("/")
    if len(parts) < 4:
        raise ValueError("Invalid checkpoint key format")
    thread_id = parts[1]
    checkpoint_ns = parts[2]
    filename = parts[3]
    checkpoint_id = filename[:-5]  # remove ".json"
    return {
        "thread_id": thread_id,
        "checkpoint_ns": checkpoint_ns,
        "checkpoint_id": checkpoint_id,
    }


class S3Saver(BaseCheckpointSaver):
    """S3-based checkpoint saver implementation."""

    def __init__(
        self,
        bucket_name: str,
        region_name: str = 'us-west-2',
        endpoint_url: Optional[str] = None,
        compression: Optional[str] = None,
    ) -> None:
        super().__init__()
        self.serde = JsonPlusSerializer(compression=compression)
        self.s3 = boto3.client('s3', region_name=region_name, endpoint_url=endpoint_url)
        self.bucket_name = bucket_name

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        checkpoint_id = checkpoint["id"]
        parent_checkpoint_id = config["configurable"].get("checkpoint_id")
        key = _make_s3_checkpoint_key(thread_id, checkpoint_ns, checkpoint_id)

        ck_type, ck_data = self.serde.dumps_typed(checkpoint)
        md_type, md_data = self.serde.dumps_typed(metadata)

        data = {
            "checkpoint_type": ck_type,
            "checkpoint_data": ck_data,
            "metadata_data": md_data,
            "parent_checkpoint_id": parent_checkpoint_id if parent_checkpoint_id else None,
            "timestamp": int(time.time() * 1000),
        }

        body = json.dumps(data).encode("utf-8")
        self.s3.put_object(Bucket=self.bucket_name, Key=key, Body=body)

        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": checkpoint_ns,
                "checkpoint_id": checkpoint_id,
            }
        }

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[Tuple[str, Any]],
        task_id: str,
    ) -> None:
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"]["checkpoint_ns"]
        checkpoint_id = config["configurable"]["checkpoint_id"]

        for idx, (channel, value) in enumerate(writes):
            v_type, v_data = self.serde.dumps_typed(value)
            write_data = {
                "channel": channel,
                "type": v_type,
                "value": v_data,
                "timestamp": int(time.time() * 1000),
            }
            write_key = _make_s3_write_key(thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=write_key,
                Body=json.dumps(write_data).encode("utf-8"),
            )

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        checkpoint_id = get_checkpoint_id(config)

        if checkpoint_id is None:
            checkpoint_id = self._get_latest_checkpoint_id(thread_id, checkpoint_ns)
            if checkpoint_id is None:
                return None

        key = _make_s3_checkpoint_key(thread_id, checkpoint_ns, checkpoint_id)
        try:
            obj = self.s3.get_object(Bucket=self.bucket_name, Key=key)
        except self.s3.exceptions.NoSuchKey:
            return None

        data = json.loads(obj["Body"].read().decode("utf-8"))

        checkpoint_type = data["checkpoint_type"]
        checkpoint_data = data["checkpoint_data"]
        checkpoint = self.serde.loads_typed((checkpoint_type, checkpoint_data))

        metadata_data = data.get("metadata_data")
        if metadata_data is None:
            raise ValueError("Metadata is missing in checkpoint data")

        metadata = self.serde.loads_typed((checkpoint_type, metadata_data))

        parent_checkpoint_id = data.get("parent_checkpoint_id")
        if parent_checkpoint_id:
            parent_config = {
                "configurable": {
                    "thread_id": thread_id,
                    "checkpoint_ns": checkpoint_ns,
                    "checkpoint_id": parent_checkpoint_id,
                }
            }
        else:
            parent_config = None

        pending_writes = self._load_pending_writes(thread_id, checkpoint_ns, checkpoint_id)

        return CheckpointTuple(
            {
                "configurable": {
                    "thread_id": thread_id,
                    "checkpoint_ns": checkpoint_ns,
                    "checkpoint_id": checkpoint_id,
                }
            },
            checkpoint,
            metadata,
            parent_config,
            pending_writes,
        )

    def list(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[Dict[str, Any]] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> Iterator[CheckpointTuple]:
        if config is None:
            raise ValueError("config must be provided for listing checkpoints in S3")

        thread_id = config["configurable"]["thread_id"]
        checkpoint_ns = config["configurable"].get("checkpoint_ns", "")
        prefix = f"checkpoints/{thread_id}/{checkpoint_ns}/"

        paginator = self.s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)

        keys = []
        for page in pages:
            contents = page.get("Contents", [])
            for c in contents:
                key = c["Key"]
                if key.endswith(".json") and "/writes/" not in key:
                    keys.append(key)

        keys_info = [_parse_s3_checkpoint_key(k) for k in keys]
        keys_info.sort(key=lambda x: x["checkpoint_id"], reverse=True)

        if before:
            before_id = before["configurable"]["checkpoint_id"]
            keys_info = [ki for ki in keys_info if ki["checkpoint_id"] < before_id]

        if limit is not None:
            keys_info = keys_info[:limit]

        for ki in keys_info:
            ck_key = _make_s3_checkpoint_key(ki["thread_id"], ki["checkpoint_ns"], ki["checkpoint_id"])
            obj = self.s3.get_object(Bucket=self.bucket_name, Key=ck_key)
            data = json.loads(obj["Body"].read().decode("utf-8"))

            checkpoint_type = data["checkpoint_type"]
            checkpoint_data = data["checkpoint_data"]
            checkpoint = self.serde.loads_typed((checkpoint_type, checkpoint_data))

            # Derive metadata_type from checkpoint_type as above
            if checkpoint_type.startswith('bz2'):
                metadata_type = 'bz2_json'
            elif checkpoint_type.startswith('gzip'):
                metadata_type = 'gzip_json'
            else:
                metadata_type = 'json'
            metadata_data = data["metadata_data"]
            metadata = self.serde.loads_typed((metadata_type, metadata_data))

            parent_checkpoint_id = data.get("parent_checkpoint_id")
            if parent_checkpoint_id:
                parent_config = {
                    "configurable": {
                        "thread_id": ki["thread_id"],
                        "checkpoint_ns": ki["checkpoint_ns"],
                        "checkpoint_id": parent_checkpoint_id,
                    }
                }
            else:
                parent_config = None

            pending_writes = self._load_pending_writes(
                ki["thread_id"], ki["checkpoint_ns"], ki["checkpoint_id"]
            )

            yield CheckpointTuple(
                {
                    "configurable": {
                        "thread_id": ki["thread_id"],
                        "checkpoint_ns": ki["checkpoint_ns"],
                        "checkpoint_id": ki["checkpoint_id"],
                    }
                },
                checkpoint,
                metadata,
                parent_config,
                pending_writes,
            )

    def _get_latest_checkpoint_id(self, thread_id: str, checkpoint_ns: str) -> Optional[str]:
        prefix = f"checkpoints/{thread_id}/{checkpoint_ns}/"
        paginator = self.s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)
        keys = []
        for page in pages:
            for c in page.get("Contents", []):
                key = c["Key"]
                if key.endswith(".json") and "/writes/" not in key:
                    keys.append(key)

        if not keys:
            return None

        keys_info = [_parse_s3_checkpoint_key(k) for k in keys]
        keys_info.sort(key=lambda x: x["checkpoint_id"], reverse=True)
        latest_id = keys_info[0]["checkpoint_id"] if keys_info else None
        return latest_id

    def _load_pending_writes(self, thread_id: str, checkpoint_ns: str, checkpoint_id: str) -> List[PendingWrite]:
        prefix = f"checkpoints/{thread_id}/{checkpoint_ns}/{checkpoint_id}/writes/"
        paginator = self.s3.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=self.bucket_name, Prefix=prefix)

        writes = []
        for page in pages:
            for c in page.get("Contents", []):
                wkey = c["Key"]
                parts = wkey.split("/")
                if len(parts) < 7:
                    continue
                task_id = parts[5]
                wobj = self.s3.get_object(Bucket=self.bucket_name, Key=wkey)
                wdata = json.loads(wobj["Body"].read().decode("utf-8"))
                channel = wdata["channel"]
                value_type = wdata["type"]
                value_data = wdata["value"]
                value = self.serde.loads_typed((value_type, value_data))
                writes.append((task_id, channel, value))

        return writes