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


# Split messages into interactions, each one starting with a HumanMessage
def _split_interactions(messages):
    if messages is None:
        return []

    interactions = []
    current_interaction = []

    for message in messages:
        if isinstance(message, HumanMessage) and current_interaction:
            interactions.append(current_interaction)
            current_interaction = []
        current_interaction.append(message)

    if current_interaction:
        interactions.append(current_interaction)

    return interactions
    
def _is_tool_message(message):
    if isinstance(message, ToolMessage):
        return True
    if isinstance(message, AIMessage) and message.response_metadata.get('stop_reason', '') == 'tool_use':
        return True
    return False

def _prune_messages(messages):
    interactions = _split_interactions(messages)
    # Remove all tool-related messages except those related to the most recent interaction
    for i, interaction in enumerate(interactions[:-1]):
        interactions[i] = [message for message in interaction if not _is_tool_message(message)]

    # Return the flattened list of messages
    return [message for interaction in interactions for message in interaction]

class SelectiveCheckpointer(S3Checkpointer):
    """S3 Checkpointer that discards ToolMessages from previous checkpoints."""
  
    def __init__(
        self,
        bucket_name: str,
        region_name: str = os.getenv("AWS_REGION"),
        endpoint_url: Optional[str] = None,
        compression: Optional[str] = None,
        retain_history: Optional[bool] = True,
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