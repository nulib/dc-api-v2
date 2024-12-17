import os
import logging

from agent.s3_saver import S3Saver
from langgraph.checkpoint.base import BaseCheckpointSaver

logger = logging.getLogger(__name__)

def create_checkpoint_saver(**kwargs) -> BaseCheckpointSaver:
    checkpoint_bucket: str = os.getenv("CHECKPOINT_BUCKET_NAME")
    
    return S3Saver(bucket_name=checkpoint_bucket, **kwargs)