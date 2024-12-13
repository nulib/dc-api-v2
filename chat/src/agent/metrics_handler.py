from typing import Any, Dict
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from langchain_core.messages.tool import ToolMessage
import json

class MetricsHandler(BaseCallbackHandler):
  def __init__(self, *args, **kwargs):
    self.accumulator = {}
    self.answers = []
    self.artifacts = []
    super().__init__(*args, **kwargs)
    
  def on_llm_end(self, response: LLMResult, **kwargs: Dict[str, Any]):
    for generation in response.generations[0]:
      self.answers.append(generation.text)
      for k, v in generation.message.usage_metadata.items():
        if k not in self.accumulator:
          self.accumulator[k] = v
        else:
          self.accumulator[k] += v

  def on_tool_end(self, output: ToolMessage, **kwargs: Dict[str, Any]):
        match output.name:
            case "aggregate":
                self.artifacts.append({"type": "aggregation", "artifact": output.artifact.get("aggregation_result", {})})
            case "search":
                try:
                    source_urls = [doc.metadata["api_link"] for doc in output.artifact]
                    self.artifacts.append({"type": "source_urls", "artifact": source_urls})
                except json.decoder.JSONDecodeError as e:
                    print(f"Invalid json ({e}) returned from {output.name} tool: {output.content}")
