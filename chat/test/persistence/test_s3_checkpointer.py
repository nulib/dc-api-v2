# ruff: noqa: E402
import sys

sys.path.append("./src")

import pytest
from unittest import TestCase

import boto3
import json
import time
from moto import mock_aws
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    Checkpoint,
    CheckpointMetadata,
)
from typing import Optional
from persistence.s3_checkpointer import S3Checkpointer

import bz2
import base64
import gzip

BUCKET_NAME = "mybucket"
REGION = "us-east-1"
THREAD_ID = "thread1"
CHECKPOINT_NAMESPACE = ""
CHECKPOINT_ID_1 = "checkpoint1"
CHECKPOINT_ID_2 = "checkpoint2"

CHECKPOINTS = [
    {
        "id": CHECKPOINT_ID_1,
        "key": "checkpoints/thread1/__default__/checkpoint1/checkpoint.json",
        "body": json.dumps(
            {
                "checkpoint_type": "json",
                "checkpoint_data": "{}",
                "metadata_data": "{}",
                "parent_checkpoint_id": None,
                "timestamp": int(time.time() * 1000),
            }
        ),
    },
    {
        "id": CHECKPOINT_ID_2,
        "key": "checkpoints/thread1/__default__/checkpoint2/checkpoint.json",
        "body": json.dumps(
            {
                "checkpoint_type": "json",
                "checkpoint_data": "{}",
                "metadata_data": "{}",
                "parent_checkpoint_id": CHECKPOINT_ID_1,
                "timestamp": int(time.time() * 1000),
            }
        ),
    },
]


@mock_aws
@pytest.mark.filterwarnings("ignore::DeprecationWarning")
class TestS3Checkpointer(TestCase):
    def setUp(self):
        """Initialize the mock S3 bucket and S3Checkpointer instance before each test."""
        self.s3 = boto3.client("s3", region_name=REGION)
        self.s3.create_bucket(Bucket=BUCKET_NAME)
        self.checkpointer = S3Checkpointer(bucket_name=BUCKET_NAME, region_name=REGION)

    def tearDown(self):
        """Clean up after each test."""
        self.checkpointer.delete_checkpoints(THREAD_ID)

    def setup_s3_bucket(self):
        """Upload sample checkpoints to the mock S3 bucket."""
        for checkpoint in CHECKPOINTS:
            self.s3.put_object(
                Bucket=BUCKET_NAME,
                Key=checkpoint["key"],
                Body=checkpoint["body"],
            )

    def create_config(self, checkpoint_id: Optional[str] = None) -> RunnableConfig:
        """Helper method to create RunnableConfig."""
        config_data = {
            "configurable": {
                "thread_id": THREAD_ID,
                "checkpoint_ns": CHECKPOINT_NAMESPACE,
            }
        }
        if checkpoint_id:
            config_data["configurable"]["checkpoint_id"] = checkpoint_id
        return RunnableConfig(config_data)

    #
    # Basic Put and Get Checkpoints
    #

    def test_put_checkpoint(self):
        """Test that S3Checkpointer.put correctly saves a checkpoint to S3."""
        new_checkpoint = Checkpoint(id="checkpoint3")
        metadata = CheckpointMetadata()
        config = self.create_config()

        returned_config = self.checkpointer.put(config, new_checkpoint, metadata, {})

        self.assertEqual(
            returned_config["configurable"]["checkpoint_id"], "checkpoint3"
        )
        expected_key = (
            f"checkpoints/{THREAD_ID}/__default__/checkpoint3/checkpoint.json"
        )
        response = self.s3.get_object(Bucket=BUCKET_NAME, Key=expected_key)
        body = json.loads(response["Body"].read().decode("utf-8"))

        self.assertEqual(body["checkpoint_type"], "json")
        checkpoint_data = json.loads(body["checkpoint_data"])
        self.assertEqual(checkpoint_data["id"], "checkpoint3")
        self.assertEqual(body["metadata_data"], "{}")
        assert body["parent_checkpoint_id"] is None
        assert "timestamp" in body

    def test_put_overwrite_checkpoint(self):
        """Test that putting a checkpoint with an existing ID overwrites it."""
        initial_checkpoint = Checkpoint(id="checkpoint6")
        initial_metadata = CheckpointMetadata()
        config = self.create_config()
        self.checkpointer.put(config, initial_checkpoint, initial_metadata, {})

        updated_checkpoint = Checkpoint(id="checkpoint6")
        updated_metadata = CheckpointMetadata()
        self.checkpointer.put(config, updated_checkpoint, updated_metadata, {})

        checkpoint_tuple = self.checkpointer.get_tuple(config)
        assert checkpoint_tuple is not None
        self.assertEqual(
            checkpoint_tuple.config["configurable"]["checkpoint_id"], "checkpoint6"
        )

    def test_put_invalid_checkpoint(self):
        """Test putting an invalid checkpoint raises appropriate errors."""
        with self.assertRaises(KeyError):
            invalid_checkpoint = {}
            config = self.create_config()
            self.checkpointer.put(config, invalid_checkpoint, CheckpointMetadata(), {})

    def test_get_tuple(self):
        """Test that S3Checkpointer.get_tuple correctly retrieves a checkpoint tuple."""
        self.setup_s3_bucket()
        config = self.create_config(checkpoint_id=CHECKPOINT_ID_2)
        checkpoint_tuple = self.checkpointer.get_tuple(config)

        assert checkpoint_tuple is not None
        assert (
            checkpoint_tuple.config["configurable"]["checkpoint_id"] == CHECKPOINT_ID_2
        )
        self.assertEqual(checkpoint_tuple.checkpoint, {})
        self.assertEqual(checkpoint_tuple.metadata, {})
        assert checkpoint_tuple.parent_config is not None
        assert (
            checkpoint_tuple.parent_config["configurable"]["checkpoint_id"]
            == CHECKPOINT_ID_1
        )
        self.assertEqual(checkpoint_tuple.pending_writes, [])

    def test_get_tuple_nonexistent_checkpoint(self):
        """Test retrieving a checkpoint tuple that does not exist."""
        config = self.create_config(checkpoint_id="nonexistent")
        checkpoint_tuple = self.checkpointer.get_tuple(config)
        assert checkpoint_tuple is None

    def test_get_tuple_no_checkpoint_id_no_existing_checkpoints(self):
        """Test get_tuple with no checkpoint_id and no existing checkpoints."""
        config = self.create_config()
        result = self.checkpointer.get_tuple(config)
        assert result is None

    def test_get_tuple_missing_metadata(self):
        """Test get_tuple when metadata is missing."""
        key = f"checkpoints/{THREAD_ID}/__default__/missing_meta/checkpoint.json"
        checkpoint_body = json.dumps(
            {
                "checkpoint_type": "json",
                "checkpoint_data": "{}",
                # "metadata_data": "{}" is intentionally omitted
                "parent_checkpoint_id": None,
                "timestamp": int(time.time() * 1000),
            }
        )
        self.s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=checkpoint_body)

        config = self.create_config(checkpoint_id="missing_meta")
        with self.assertRaises(ValueError) as context:
            self.checkpointer.get_tuple(config)

        self.assertIn("Metadata is missing", str(context.exception))

    #
    # Writes (Pending Writes) Tests
    #

    def test_put_writes(self):
        """Test that S3Checkpointer.put_writes correctly saves writes to S3."""
        checkpoint = Checkpoint(id="checkpoint4")
        metadata = CheckpointMetadata()
        config = self.create_config()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})

        writes = [
            ("channel1", {"data": "value1"}),
            ("channel2", {"data": "value2"}),
        ]
        task_id = "task123"
        self.checkpointer.put_writes(returned_config, writes, task_id)

        for idx, (channel, value) in enumerate(writes):
            write_key = f"checkpoints/{THREAD_ID}/__default__/checkpoint4/writes/{task_id}/{idx}.json"
            response = self.s3.get_object(Bucket=BUCKET_NAME, Key=write_key)
            body = json.loads(response["Body"].read().decode("utf-8"))
            self.assertEqual(body["channel"], channel)
            self.assertEqual(body["type"], "json")
            self.assertEqual(body["value"], json.dumps(value))
            assert "timestamp" in body

    def test_put_writes_empty(self):
        """Test putting an empty list of writes."""
        checkpoint = Checkpoint(id="checkpoint_empty_writes")
        metadata = CheckpointMetadata()
        config = self.create_config()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})
        self.checkpointer.put_writes(returned_config, [], "task_empty")

        checkpoint_tuple = self.checkpointer.get_tuple(returned_config)
        assert checkpoint_tuple is not None
        self.assertEqual(checkpoint_tuple.pending_writes, [])

    def test_put_writes_multiple_tasks(self):
        """Test putting writes from multiple tasks."""
        checkpoint = Checkpoint(id="checkpoint_multi_tasks")
        metadata = CheckpointMetadata()
        config = self.create_config()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})

        writes_task1 = [
            ("channel1", {"data": "task1_value1"}),
            ("channel2", {"data": "task1_value2"}),
        ]
        writes_task2 = [
            ("channel1", {"data": "task2_value1"}),
        ]

        self.checkpointer.put_writes(returned_config, writes_task1, "task1")
        self.checkpointer.put_writes(returned_config, writes_task2, "task2")

        checkpoint_tuple = self.checkpointer.get_tuple(returned_config)
        assert checkpoint_tuple is not None
        self.assertEqual(len(checkpoint_tuple.pending_writes), 3)

        task1_writes = [w for w in checkpoint_tuple.pending_writes if w[0] == "task1"]
        self.assertEqual(len(task1_writes), 2)
        self.assertEqual(task1_writes[0][1], "channel1")
        self.assertEqual(task1_writes[0][2], {"data": "task1_value1"})
        self.assertEqual(task1_writes[1][1], "channel2")
        self.assertEqual(task1_writes[1][2], {"data": "task1_value2"})

        task2_writes = [w for w in checkpoint_tuple.pending_writes if w[0] == "task2"]
        self.assertEqual(len(task2_writes), 1)
        self.assertEqual(task2_writes[0][1], "channel1")
        self.assertEqual(task2_writes[0][2], {"data": "task2_value1"})

    def test_get_tuple_with_writes(self):
        """Test retrieving a checkpoint tuple that includes pending writes."""
        checkpoint = Checkpoint(id="checkpoint5")
        metadata = CheckpointMetadata()
        config = self.create_config()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})

        writes = [
            ("channelA", {"info": "dataA"}),
            ("channelB", {"info": "dataB"}),
        ]
        task_id = "task456"
        self.checkpointer.put_writes(returned_config, writes, task_id)

        checkpoint_tuple = self.checkpointer.get_tuple(returned_config)
        assert checkpoint_tuple is not None
        self.assertEqual(
            checkpoint_tuple.config["configurable"]["checkpoint_id"], "checkpoint5"
        )
        self.assertEqual(checkpoint_tuple.checkpoint["id"], "checkpoint5")
        self.assertEqual(checkpoint_tuple.metadata, {})
        assert checkpoint_tuple.parent_config is None
        self.assertEqual(len(checkpoint_tuple.pending_writes), 2)
        for i, (task, channel, value) in enumerate(checkpoint_tuple.pending_writes):
            self.assertEqual(task, task_id)
            self.assertEqual(channel, writes[i][0])
            self.assertEqual(value, writes[i][1])

    #
    # Listing Checkpoints and Filters
    #

    def test_list_checkpoints_with_filters(self):
        """Test listing checkpoints with filters like 'before' and 'limit'."""
        self.setup_s3_bucket()
        saver = self.checkpointer
        config = self.create_config()

        all_checkpoints = list(saver.list(config))
        self.assertEqual(len(all_checkpoints), len(CHECKPOINTS))

        limited_checkpoints = list(saver.list(config, limit=1))
        self.assertEqual(len(limited_checkpoints), 1)
        assert (
            limited_checkpoints[0].config["configurable"]["checkpoint_id"]
            == CHECKPOINT_ID_2
        )

        before_config = self.create_config(checkpoint_id=CHECKPOINT_ID_2)
        before_checkpoints = list(saver.list(config, before=before_config))
        self.assertEqual(len(before_checkpoints), 1)
        assert (
            before_checkpoints[0].config["configurable"]["checkpoint_id"]
            == CHECKPOINT_ID_1
        )

    def test_list_no_checkpoints(self):
        """Test listing checkpoints when none exist."""
        config = self.create_config()
        retrieved_checkpoints = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_checkpoints), 0)

    def test_list_with_limit(self):
        """Test listing with a limit."""
        self.setup_s3_bucket()
        config = self.create_config()
        results = list(self.checkpointer.list(config, limit=1))
        self.assertEqual(len(results), 1)

    def test_list_no_config(self):
        """Test listing when no config is provided."""
        with self.assertRaises(ValueError) as context:
            list(self.checkpointer.list(None))

        self.assertIn("config must be provided", str(context.exception))

    def test_list_before_removes_all(self):
        """Test listing with a 'before' config that removes all results."""
        self.setup_s3_bucket()
        config = self.create_config()
        before_config = self.create_config(checkpoint_id="checkpoint0")
        results = list(self.checkpointer.list(config, before=before_config))
        self.assertEqual(len(results), 0)

    #
    # Parent-Child Checkpoint Relationship
    #

    def test_put_and_get_with_parent_checkpoint(self):
        """Test putting a checkpoint with a parent and retrieving the parent config."""
        parent_checkpoint = Checkpoint(id="parent_checkpoint")
        parent_metadata = CheckpointMetadata()
        parent_config = self.create_config()
        self.checkpointer.put(parent_config, parent_checkpoint, parent_metadata, {})

        child_checkpoint = Checkpoint(id="child_checkpoint")
        child_metadata = CheckpointMetadata()
        child_config = RunnableConfig(
            {
                "configurable": {
                    "thread_id": THREAD_ID,
                    "checkpoint_ns": CHECKPOINT_NAMESPACE,
                    "checkpoint_id": "parent_checkpoint",
                }
            }
        )
        self.checkpointer.put(child_config, child_checkpoint, child_metadata, {})

        child_tuple = self.checkpointer.get_tuple(
            RunnableConfig(
                {
                    "configurable": {
                        "thread_id": THREAD_ID,
                        "checkpoint_ns": CHECKPOINT_NAMESPACE,
                        "checkpoint_id": "child_checkpoint",
                    }
                }
            )
        )
        assert child_tuple is not None
        self.assertEqual(
            child_tuple.config["configurable"]["checkpoint_id"], "child_checkpoint"
        )
        assert child_tuple.parent_config is not None
        assert (
            child_tuple.parent_config["configurable"]["checkpoint_id"]
            == "parent_checkpoint"
        )

    #
    # Namespaces
    #

    def test_put_with_namespace(self):
        """Test putting and retrieving a checkpoint within a specific namespace."""
        namespace = "custom_ns"
        config = RunnableConfig(
            {
                "configurable": {
                    "thread_id": THREAD_ID,
                    "checkpoint_ns": namespace,
                }
            }
        )
        checkpoint = Checkpoint(id="checkpoint_ns1")
        metadata = CheckpointMetadata()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})

        retrieved_tuple = self.checkpointer.get_tuple(returned_config)
        assert retrieved_tuple is not None
        self.assertEqual(
            retrieved_tuple.config["configurable"]["checkpoint_ns"], namespace
        )
        assert (
            retrieved_tuple.config["configurable"]["checkpoint_id"] == "checkpoint_ns1"
        )

        retrieved_checkpoints = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_checkpoints), 1)
        assert (
            retrieved_checkpoints[0].config["configurable"]["checkpoint_id"]
            == "checkpoint_ns1"
        )

    def test_list_with_non_default_namespace(self):
        """Test listing checkpoints in a non-default namespace."""
        namespace = "ns1"
        config = RunnableConfig(
            {
                "configurable": {
                    "thread_id": THREAD_ID,
                    "checkpoint_ns": namespace,
                }
            }
        )

        checkpoint_ns1 = Checkpoint(id="ns1_ckpt1")
        checkpoint_ns2 = Checkpoint(id="ns2_ckpt1")
        metadata = CheckpointMetadata()

        self.checkpointer.put(config, checkpoint_ns1, metadata, {})

        config_ns2 = RunnableConfig(
            {
                "configurable": {
                    "thread_id": THREAD_ID,
                    "checkpoint_ns": "ns2",
                }
            }
        )
        self.checkpointer.put(config_ns2, checkpoint_ns2, metadata, {})

        retrieved_ns1 = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_ns1), 1)
        self.assertEqual(
            retrieved_ns1[0].config["configurable"]["checkpoint_id"], "ns1_ckpt1"
        )

        retrieved_ns2 = list(self.checkpointer.list(config_ns2))
        self.assertEqual(len(retrieved_ns2), 1)
        self.assertEqual(
            retrieved_ns2[0].config["configurable"]["checkpoint_id"], "ns2_ckpt1"
        )

    #
    # Compression
    #

    def test_put_with_compression(self):
        """Test putting a checkpoint with compression enabled."""
        import base64

        saver_compressed = S3Checkpointer(
            bucket_name=BUCKET_NAME, region_name=REGION, compression="gzip"
        )

        checkpoint = Checkpoint(id="checkpoint_compressed")
        metadata = CheckpointMetadata()
        config = self.create_config()
        saver_compressed.put(config, checkpoint, metadata, {})

        expected_key = (
            f"checkpoints/{THREAD_ID}/__default__/checkpoint_compressed/checkpoint.json"
        )
        response = self.s3.get_object(Bucket=BUCKET_NAME, Key=expected_key)
        body = json.loads(response["Body"].read().decode("utf-8"))

        checkpoint_data_encoded = body["checkpoint_data"]
        checkpoint_data = base64.b64decode(checkpoint_data_encoded)
        assert checkpoint_data.startswith(b"\x1f\x8b")  # Gzip magic number

    def test_list_bz2_checkpoints(self):
        """Test listing a checkpoint where checkpoint_type starts with 'bz2'."""
        compressed_data = base64.b64encode(bz2.compress(b"{}")).decode("utf-8")
        key = f"checkpoints/{THREAD_ID}/__default__/bz2_ckpt/checkpoint.json"
        data = {
            "checkpoint_type": "bz2_json",
            "checkpoint_data": compressed_data,
            "metadata_data": compressed_data,
            "parent_checkpoint_id": None,
            "timestamp": int(time.time() * 1000),
        }
        self.s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=json.dumps(data))

        config = self.create_config(checkpoint_id="bz2_ckpt")
        retrieved_checkpoints = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_checkpoints), 1)
        self.assertEqual(retrieved_checkpoints[0].checkpoint, {})
        self.assertEqual(retrieved_checkpoints[0].metadata, {})

    def test_list_gzip_checkpoints(self):
        """Test listing a checkpoint where checkpoint_type starts with 'gzip'."""
        compressed_data = base64.b64encode(gzip.compress(b"{}")).decode("utf-8")
        key = f"checkpoints/{THREAD_ID}/__default__/gzip_ckpt/checkpoint.json"
        data = {
            "checkpoint_type": "gzip_json",
            "checkpoint_data": compressed_data,
            "metadata_data": compressed_data,
            "parent_checkpoint_id": None,
            "timestamp": int(time.time() * 1000),
        }
        self.s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=json.dumps(data))

        config = self.create_config(checkpoint_id="gzip_ckpt")
        retrieved_checkpoints = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_checkpoints), 1)
        self.assertEqual(retrieved_checkpoints[0].checkpoint, {})
        self.assertEqual(retrieved_checkpoints[0].metadata, {})

    #
    # Concurrency
    #

    def test_concurrent_puts(self):
        """Test concurrent puts to ensure thread safety (basic simulation)."""
        import threading

        def put_checkpoint(id_suffix):
            checkpoint = Checkpoint(id=f"checkpoint_concurrent_{id_suffix}")
            metadata = CheckpointMetadata()
            config = self.create_config()
            self.checkpointer.put(config, checkpoint, metadata, {})

        threads = []
        for i in range(5):
            t = threading.Thread(target=put_checkpoint, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        config = self.create_config()
        retrieved_checkpoints = list(self.checkpointer.list(config))
        expected_ids = {f"checkpoint_concurrent_{i}" for i in range(5)}
        retrieved_ids = {
            ck.config["configurable"]["checkpoint_id"] for ck in retrieved_checkpoints
        }
        assert expected_ids.issubset(retrieved_ids)

    #
    # Latest Checkpoint ID
    #

    def test_get_latest_checkpoint_id(self):
        """Test the internal method to get the latest checkpoint ID."""
        self.setup_s3_bucket()
        latest_id = self.checkpointer._get_latest_checkpoint_id(
            THREAD_ID, CHECKPOINT_NAMESPACE
        )
        self.assertEqual(latest_id, CHECKPOINT_ID_2)

    def test_get_latest_checkpoint_id_no_keys(self):
        """Test getting the latest checkpoint ID when none exist."""
        latest_id = self.checkpointer._get_latest_checkpoint_id(
            THREAD_ID, CHECKPOINT_NAMESPACE
        )
        assert latest_id is None

    #
    # Deleting Checkpoints
    #

    def test_delete_checkpoints(self):
        """Test that delete_checkpoints correctly removes all checkpoints for a thread."""
        self.setup_s3_bucket()
        config = self.create_config()
        retrieved_checkpoints = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_checkpoints), len(CHECKPOINTS))

        self.checkpointer.delete_checkpoints(THREAD_ID)
        retrieved_after_delete = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_after_delete), 0)

    def test_delete_checkpoints_many(self):
        """Test deleting multiple checkpoints in batches."""
        for i in range(3):
            ckpt = Checkpoint(id=f"ckpt_del_{i}")
            metadata = CheckpointMetadata()
            config = self.create_config()
            self.checkpointer.put(config, ckpt, metadata, {})

        self.checkpointer.delete_checkpoints(THREAD_ID)
        retrieved_after_delete = list(self.checkpointer.list(self.create_config()))
        self.assertEqual(len(retrieved_after_delete), 0)

    #
    # Invalid Key Formats and Other Edge Cases
    #

    def test_load_pending_writes_invalid_key_format(self):
        """Test _load_pending_writes handling invalid write key formats."""
        checkpoint = Checkpoint(id="ckpt_invalid_write")
        metadata = CheckpointMetadata()
        config = self.create_config()
        returned_config = self.checkpointer.put(config, checkpoint, metadata, {})

        invalid_write_key = f"checkpoints/{THREAD_ID}/__default__/ckpt_invalid_write/writes/invalid.json"
        self.s3.put_object(Bucket=BUCKET_NAME, Key=invalid_write_key, Body="{}")

        tuple_result = self.checkpointer.get_tuple(returned_config)
        assert tuple_result is not None
        # No valid writes parsed due to invalid format
        self.assertEqual(tuple_result.pending_writes, [])

    def test_invalid_checkpoint_key_format(self):
        """Test handling of invalid checkpoint key formats."""
        invalid_key = "checkpoints/thread1/__default__/invalid_format.json"
        self.s3.put_object(
            Bucket=BUCKET_NAME,
            Key=invalid_key,
            Body='{"invalid": "data"}',
        )

        config = self.create_config()
        with self.assertRaises(ValueError) as context:
            list(self.checkpointer.list(config))

        self.assertIn("Invalid checkpoint key format", str(context.exception))

    @pytest.mark.slow
    def test_delete_checkpoints_large_batch(self):
        """Test deleting more than 1000 checkpoints to verify batch deletion logic."""
        # Create 1001 objects to force batch deletion
        for i in range(1001):
            ckpt = Checkpoint(id=f"ckpt_del_{i}")
            metadata = CheckpointMetadata()
            config = self.create_config()
            self.checkpointer.put(config, ckpt, metadata, {})

        # Verify objects were created
        config = self.create_config()
        retrieved_before_delete = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_before_delete), 1001)

        # Delete all checkpoints
        self.checkpointer.delete_checkpoints(THREAD_ID)

        # Verify all objects were deleted
        retrieved_after_delete = list(self.checkpointer.list(config))
        self.assertEqual(len(retrieved_after_delete), 0)
