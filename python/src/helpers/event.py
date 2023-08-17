from .apitoken import ApiToken
import base64
import os

class Event:
  def __init__(self, event):
    self.event = event
    cookies_from_event = event.get("cookies", [])
    cookie_list = [
        cookie.split("=", 1) if "=" in cookie else ("", cookie)
        for cookie in cookies_from_event
    ]
    self.cookies = dict(cookie_list)
    token = self.header("Authorization") or self.cookie(os.getenv("API_TOKEN_NAME"))
    if isinstance(token, str):
      token = token.replace("Bearer ", "")
    self.api_token = ApiToken(token)

  def header(self, header, default=None):
    headers = self.event.get("headers")
    return headers.get(header, headers.get(header.lower(), default))

  def param(self, parameter, default=None):
    params = self.event.get("queryStringParameters", {})
    return params.get(parameter, default)
  
  def method(self):
    return self.event["requestContext"]["http"]["method"]

  def is_get_request(self):
    return self.method() == "GET"
  def is_head_request(self):
    return self.method() == "HEAD"
  def is_options_request(self):
    return self.method() == "OPTIONS"
  def is_post_request(self):
    return self.method() == "POST"
  
  def body(self):
    result = self.event.get("body", None)
    if result is None or result == "":
      return None
    if self.event.get("isBase64Encoded", False):
      return base64.b64decode(result).decode("UTF-8")
    return result

  def cookie(self, name, default=None):
    return self.cookies.get(name, default)
