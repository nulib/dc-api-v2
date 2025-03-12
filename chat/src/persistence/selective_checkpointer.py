import os
from typing import Optional
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata
)
from persistence.s3_checkpointer import S3Checkpointer

def _is_tool_message(message):
    if isinstance(message, ToolMessage):
        return True
    if isinstance(message, AIMessage) and message.additional_kwargs.get('stop_reason', '') == 'tool_use':
        return True
    return False

def _prune_messages(messages):
    if messages is None:
        return messages

    last_human_message = None
    for i, message in reversed(list(enumerate(messages))):
        if isinstance(message, HumanMessage):
            last_human_message = i
            break

    if last_human_message is not None:
        return [
            msg
            for i, msg in enumerate(messages)
            if not _is_tool_message(msg) or i > last_human_message
        ]

    return messages

class SelectiveCheckpointer(S3Checkpointer):
    """S3 Checkpointer that discards ToolMessages from previous checkpoints."""
  
    def __init__(
        self,
        bucket_name: str,
        region_name: str = os.getenv("AWS_REGION"),
        endpoint_url: Optional[str] = None,
        compression: Optional[str] = None,
        retain_history: Optional[bool] = False,
    ) -> None:
        super().__init__(bucket_name, region_name, endpoint_url, compression)
        self.retain_history = retain_history

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        # Remove previous checkpoints
        thread_id = config["configurable"]["thread_id"]
        if not self.retain_history:
            self.delete_checkpoints(thread_id)
        
        # Remove all ToolMessages except those related to the most 
        # recent question (HumanMessage)
        messages = checkpoint.get("channel_values", {}).get("messages", [])
        checkpoint["channel_values"]["messages"] = _prune_messages(messages)

        return super().put(config, checkpoint, metadata, new_versions)