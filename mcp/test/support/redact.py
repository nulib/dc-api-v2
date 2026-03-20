import json
import re

REDACT_RESPONSE_HEADERS = {"set-cookie", "x-api-key"}
REDACT_REQUEST_HEADERS = {"authorization", "x-api-key"}
REDACT_REQUEST_BODY = [
  ['"model_id":\\s*".+?"', '"model_id":"************"'],
]
PLACEHOLDER = "REDACTED"

def response(flow):
    for header in REDACT_REQUEST_HEADERS:
        if header in flow.request.headers:
            flow.request.headers[header] = PLACEHOLDER

    for header in REDACT_RESPONSE_HEADERS:
        if header in flow.response.headers:
            flow.response.headers[header] = PLACEHOLDER

    content_type = flow.request.headers.get("content-type", "")
    if "application/json" in content_type and flow.request.content:
        body = flow.request.content.decode("utf-8")
        for pattern, replacement in REDACT_REQUEST_BODY:
            body = re.sub(pattern, replacement, body)
        flow.request.content = body.encode("utf-8")
