from datetime import datetime
import jwt
import os

class ApiToken:
  @classmethod
  def empty_token(cls):
    time = int(datetime.now().timestamp())
    return {
      'iss': os.getenv('DC_API_ENDPOINT'),
      'exp': datetime.fromtimestamp(time + 12 * 60 * 60).timestamp(), # 12 hours
      'iat': time,
      'entitlements': [],
      'isLoggedIn': False,
    }
  
  def __init__(self, signed_token=None):
    if signed_token is None:
      self.token = ApiToken.empty_token()
    else:
      try:
        secret = os.getenv("API_TOKEN_SECRET")
        self.token = jwt.decode(signed_token, secret, algorithms=["HS256"])
      except Exception:
        self.token = ApiToken.empty_token()

  def is_logged_in(self):
    return self.token.get("isLoggedIn", False)
  
  def is_superuser(self):
    return self.token.get("isSuperUser", False)
