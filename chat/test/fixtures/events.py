from copy import deepcopy
from test.fixtures.apitoken import TEST_TOKEN_NAME, TEST_TOKEN

POST_EVENT = {
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/chat",
  "cookies": [
    "cookie_1=cookie_value_1",
    "cookie_2=cookie_value_2",
  ],
  "headers": {
    "Authorization": f"Bearer {TEST_TOKEN}",
    "origin": "https://example.edu"
  },
  "queryStringParameters": {
    "param1": "value1",
    "param2": "value2",
  },
  "requestContext": {
    "accountId": "123456789012",
    "apiId": "api-id",
    "domainName": "id.execute-api.us-east-1.amazonaws.com",
    "domainPrefix": "id",
    "http": {
      "method": "POST",
      "path": "/chat",
      "protocol": "HTTP/1.1",
      "sourceIp": "192.168.0.1/32",
      "userAgent": "agent"
    },
    "requestId": "id",
    "routeKey": "$default",
    "stage": "$default",
    "time": "12/Mar/2020:19:03:58 +0000",
    "timeEpoch": 1583348638390
  },
  "body": "UE9TVGVkIENvbnRlbnQ=",
  "pathParameters": {},
  "isBase64Encoded": True,
  "stageVariables": {}
}

PLAIN_BODY_EVENT = deepcopy(POST_EVENT)
PLAIN_BODY_EVENT["isBase64Encoded"] = False
PLAIN_BODY_EVENT["body"] = "POSTed Content"

NO_BODY_EVENT = deepcopy(POST_EVENT)
NO_BODY_EVENT["isBase64Encoded"] = False
NO_BODY_EVENT["body"] = ""

NO_TOKEN_EVENT = deepcopy(POST_EVENT)
del NO_TOKEN_EVENT["headers"]["Authorization"]

COOKIE_TOKEN_EVENT = deepcopy(NO_TOKEN_EVENT)
COOKIE_TOKEN_EVENT["cookies"].append(f"{TEST_TOKEN_NAME}={TEST_TOKEN}")
