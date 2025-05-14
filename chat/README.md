# dc-api-v2 chatbot

[![Build Status](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml/badge.svg)](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml)

## Local development setup

Follow the instructions in the [main `README`](../README.md) to deploy or sync a development stack 
that includes the `CHAT` feature.


### Websocket Communication

The DC API uses websockets to enable real-time, bi-directional communication between the frontend application and the chat API. This is particularly important for streaming chat responses where messages need to be delivered incrementally.

#### Connection

The websocket endpoint is available at:
```
wss://[API_ENDPOINT]/chat
```

##### Client to Server Messages

To initiate a chat conversation, send:
```json
{
  "question": "Your question here",
  "docs": ["work-id-1", "work-id-2"],
  "auth": "jwt-token",
  "stream_response": true,
  "ref": "abc123"
}
```

Additional optional parameters:
- `forget`: boolean (default: false) - Start a new conversation
- `model`: string - Specify the LLM model to use (superuser only)
- `k`: number - Number of documents to retrieve (superuser only)
- `temperature`: number - Model temperature (superuser only)

##### Server to Client Messages

#### Server Message Format

Messages from the API on the server-side follow this general structure:

```json
{
  "type": "string",      // Type of message
  "message": "string",   // Content of the message
  "ref": "string",      // Reference ID for tracking conversation
}
```

The server sends different types of messages:

1. Start Message:
```json
{
  "type": "start",
  "message": {
    "model": "model_name"
  },
  "ref": "conversation-id"
}
```

2. Token Updates:
```json
{
  "type": "token",
  "message": "partial response text",
  "ref": "conversation-id"
}
```

3. Stop Message:
```json
{
  "type": "stop",
  "ref": "conversation-id"
}
```

4. Answer Message:
```json
{
  "type": "answer",
  "message": "response content",
  "ref": "conversation-id"
}
```

5. Final Message:
```json
{
  "type": "final_message",
  "ref": "conversation-id"
}
```

6. Tool Start:
```json
{
  "type": "tool_start",
  "message": {
    "tool": "tool_name",
    "input": "tool input"
  },
  "ref": "conversation-id"
}
```

7. Aggregation Result:
```json
{
  "type": "aggregation_result",
  "message": {
    // example aggregation result object
    "buckets": [
      {
        "key": "bucket-key",
        "doc_count": 10
      }
    ],
    "sum_other_doc_count": 34,
    "doc_count_error_upper_bound": 0,
  },
  "ref": "conversation-id"
}
```

8. Search Result:
```json
{
  "type": "search_result",
  "message": [
    {
      "id": "work-id",
      "title": "work title",
      "visibility": "visibility status",
      "work_type": "type",
      "thumbnail": "thumbnail url"
    }
  ],
  "ref": "conversation-id"
}
```

9. Final Completion:
```json
{
  "type": "final",
  "message": "Finished", // Hard-coded value for the message
  "ref": "conversation-id"
}
```

10. Error Messages:
```json
{
  "type": "error",
  "message": "error description",
  "ref": "conversation-id"
}
```

#### Error Handling

- 401 Unauthorized: Returned when the authentication token is missing or invalid
- 400 Bad Request: Returned when the question is blank or missing
- Connection errors will emit an "error" type message through the websocket


## Security and Authentication

The chat service uses JWT-based authentication inherited from the main DC API. Each WebSocket connection requires a valid JWT token to be provided in the connection payload.

### Token Requirements

- Tokens must be signed with the shared API secret
- Tokens contain user entitlements and authentication status
- Standard tokens expire after 12 hours
- Anonymous access is supported with limited capabilities

### Security Features

- Token validation occurs on every connection
- User privileges are enforced via the `ApiToken` class
- Advanced features like model selection and debug mode require superuser status 
- Temperature and context window size limits are enforced for non-superusers
- All chat interactions are logged for auditing purposes

### Environment Configuration

The following security-related environment variables must be configured:

```
API_TOKEN_NAME - Name of the JWT cookie/header
API_TOKEN_SECRET - Shared secret for validating JWTs
```

### Authorization Levels

The chat service implements the following authorization levels:

- **Unauthorized**: No access to chat functionality
- **Authenticated Users** (config.is_logged_in=true):
  - Basic chat functionality
  - Default model settings
  - Standard context window limits
  - Fixed temperature settings
- **Dev Team** (config.is_dev_team=true):
  - Same access as authenticated users
  - Flagged in metrics logs for filtering development traffic
  - No additional feature permissions
- **Superusers** (config.is_superuser=true): 
  - Custom prompts
  - Model selection
  - Debug mode
  - Temperature control
  - Unrestricted context window
  - Scope to override system defaults
