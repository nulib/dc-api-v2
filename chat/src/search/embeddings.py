import json
import os
from functools import lru_cache
from typing import List, Tuple

import boto3


class EmbeddingError(Exception):
    """Raised when search text cannot be embedded."""


@lru_cache(maxsize=1)
def _client():
    return boto3.client("lambda", region_name=os.getenv("AWS_REGION", "us-east-1"))


@lru_cache(maxsize=256)
def _embed(text: str) -> Tuple[float, ...]:
    function_name = os.getenv("EMBEDDING_FUNCTION")
    if not function_name:
        raise EmbeddingError("EMBEDDING_FUNCTION is not configured")

    try:
        response = _client().invoke(
            FunctionName=function_name,
            Payload=json.dumps({"texts": [text], "task": "query"}),
        )
    except Exception as err:
        raise EmbeddingError("Embedding function could not be invoked") from err

    if response.get("FunctionError"):
        raise EmbeddingError(f"Embedding function failed: {response['FunctionError']}")

    body = json.loads(response["Payload"].read() or "{}")
    embeddings = body.get("embeddings") or []
    if body.get("error") or not embeddings:
        raise EmbeddingError(
            body.get("error") or "Embedding function returned no embedding"
        )

    return tuple(embeddings[0])


def embed_query(text: str) -> List[float]:
    """Embed search text with the model Meadow embeds work documents with.

    The index stores precomputed document vectors and has no model of its own,
    so search text is embedded by the embed function (see ../../../embed).
    Results are cached for the life of the process; failures are not.
    """
    return list(_embed(text))


def clear_cache():
    _embed.cache_clear()
    _client.cache_clear()
