from datetime import datetime
from typing import Any, Dict
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from langchain_core.messages.tool import ToolMessage
import boto3
import json
import os


class MetricsCallbackHandler(BaseCallbackHandler):
    def __init__(self, log_stream=None, *args, extra_data={}, **kwargs):
        self.accumulator = {}
        self.answers = []
        self.artifacts = []
        self.log_stream = log_stream
        self.extra_data = extra_data
        super().__init__(*args, **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs):
        if response is None:
            return

        if not response.generations or not response.generations[0]:
            return

        for generation in response.generations[0]:
            if generation.text != "":
                self.answers.append(generation.text)

            if not hasattr(generation, "message") or generation.message is None:
                continue

            metadata = getattr(generation.message, "usage_metadata", None)
            if metadata is None:
                continue

            for k, v in metadata.items():
                if isinstance(v, (int, float)):
                    self.accumulator[k] = self.accumulator.get(k, 0) + v
                else:
                    self.accumulator[k] = v

    def on_tool_end(self, output: ToolMessage, **kwargs: Dict[str, Any]):
        content = output.content
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except json.decoder.JSONDecodeError as e:
                print(
                    f"Invalid json ({e}) returned from {output.name} tool: {output.content}"
                )
                return

        match output.name:
            case "aggregate":
                self.artifacts.append(
                    {
                        "type": "aggregation",
                        "artifact": content.get("aggregation_result", {}),
                    }
                )
            case "search":
                source_urls = [doc.get("api_link") for doc in content]
                self.artifacts.append({"type": "source_urls", "artifact": source_urls})
            case "summarize":
                print(output)

    def log_metrics(self):
        if self.log_stream is None:
            return

        log_group = os.getenv("METRICS_LOG_GROUP")
        if log_group and ensure_log_stream_exists(log_group, self.log_stream):
            client = log_client()
            message = {
                "answer": self.answers,
                "artifacts": self.artifacts,
                "token_counts": self.accumulator,
            }
            message.update(self.extra_data)

            log_events = [
                {
                    "timestamp": timestamp(),
                    "message": json.dumps(message),
                }
            ]
            client.put_log_events(
                logGroupName=log_group,
                logStreamName=self.log_stream,
                logEvents=log_events,
            )


def ensure_log_stream_exists(log_group, log_stream):
    client = log_client()
    try:
        print(
            client.create_log_stream(logGroupName=log_group, logStreamName=log_stream)
        )
        return True
    except client.exceptions.ResourceAlreadyExistsException:
        return True
    except Exception:
        print(f"Could not create log stream: {log_group}:{log_stream}")
        return False


def log_client():
    return boto3.client("logs", region_name=os.getenv("AWS_REGION", "us-east-1"))


def timestamp():
    return round(datetime.timestamp(datetime.now()) * 1000)
