from typing import Any, Dict
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult
from langchain_core.messages.tool import ToolMessage
import json

class MetricsCallbackHandler(BaseCallbackHandler):
  def __init__(self, *args, **kwargs):
    self.accumulator = {}
    self.answers = []
    self.artifacts = []
    super().__init__(*args, **kwargs)

  def on_llm_end(self, response: LLMResult, **kwargs: Dict[str, Any]):
    if response is None:
        return

    if not response.generations or not response.generations[0]:
        return
        
    for generation in response.generations[0]:
      if generation.text != "":
        self.answers.append(generation.text)

      if not hasattr(generation, 'message') or generation.message is None:
          continue
          
      metadata = getattr(generation.message, 'usage_metadata', None)
      if metadata is None:
          continue
          
      for k, v in metadata.items():
          self.accumulator[k] = self.accumulator.get(k, 0) + v

  def on_tool_end(self, output: ToolMessage, **kwargs: Dict[str, Any]):
        content = output.content
        if isinstance(content, str):
            content = json.loads(content)
      
        match output.name:
            case "aggregate":
                self.artifacts.append({"type": "aggregation", "artifact": content.get("aggregation_result", {})})
            case "search":
                try:
                    source_urls = [doc.metadata["api_link"] for doc in content]
                    self.artifacts.append({"type": "source_urls", "artifact": source_urls})
                except json.decoder.JSONDecodeError as e:
                    print(f"Invalid json ({e}) returned from {output.name} tool: {output.content}")
