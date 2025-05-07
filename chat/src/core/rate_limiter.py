import hashlib
import time
import os
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError


class RateLimiter:
    def __init__(self, max_requests=200, period_seconds=7 * 24 * 60 * 60):
        self.dynamodb = boto3.resource(
            "dynamodb", region_name=os.getenv("AWS_REGION", "us-east-1")
        )
        self.table_name = os.environ.get("RATE_LIMIT_TABLE_NAME", "ChatApiRateLimits")
        self.table = self.dynamodb.Table(self.table_name)
        self.max_requests = max_requests
        self.period_seconds = period_seconds  # 7 days in seconds

    def _hash_sub(self, sub):
        if not sub:
            return None
        full_hash = hashlib.sha256(sub.lower().encode()).digest()
        return full_hash[:12].hex()

    def check_rate_limit(self, sub):
        """
        Check if the user has exceeded their rate limit
        Returns (is_allowed, remaining_requests)
        """
        if not sub:
            return False, 0

        user_id = self._hash_sub(sub)
        current_time = int(time.time())
        period_start = current_time - self.period_seconds

        try:
            # Get the current usage record for the user
            response = self.table.get_item(Key={"user_id": user_id})

            item = response.get("Item", None)

            if not item:
                # Create new record for first-time user
                self.table.put_item(
                    Item={
                        "user_id": user_id,
                        "request_count": 1,
                        "first_request_time": Decimal(current_time),
                        "last_request_time": Decimal(current_time),
                    }
                )
                return True, self.max_requests - 1

            # Reset counter if last request was outside the current period
            first_request_time = item.get("first_request_time")
            if first_request_time < Decimal(period_start):
                response = self.table.update_item(
                    Key={"user_id": user_id},
                    UpdateExpression="SET request_count = :count, first_request_time = :time, last_request_time = :time",
                    ExpressionAttributeValues={
                        ":count": 1,
                        ":time": Decimal(current_time),
                    },
                )
                print(f"DynamoDB update_item response (reset): {response}")
                return True, self.max_requests - 1

            # Check if user has exceeded rate limit
            request_count = item.get("request_count", 0)
            remaining = self.max_requests - request_count

            if request_count >= self.max_requests:
                return False, 0

            # Increment the counter
            self.table.update_item(
                Key={"user_id": user_id},
                UpdateExpression="SET request_count = request_count + :inc, last_request_time = :time",
                ExpressionAttributeValues={":inc": 1, ":time": Decimal(current_time)},
            )

            return True, remaining - 1

        except ClientError as e:
            # Log the error but don't block the request on rate limit failures
            print(f"Error checking rate limit: {str(e)}")
            return True, 0
