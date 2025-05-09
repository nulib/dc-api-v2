import hashlib
import time
import os
import boto3
from decimal import Decimal
from botocore.exceptions import ClientError
from datetime import datetime, timezone, timedelta



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
            ttl_value = Decimal(current_time + 30 * 24 * 60 * 60)
            item = response.get("Item", None)


            if not item:
                # Create new record for first-time user
                self.table.put_item(
                    Item={
                        "user_id": user_id,
                        "request_count": 1,
                        "first_request_time": Decimal(current_time),
                        "ttl": ttl_value
                    }
                )
                return True, self.max_requests - 1

            # Reset counter if last request was outside the current period
            first_request_time = item.get("first_request_time")
            if first_request_time < Decimal(period_start):
                response = self.table.update_item(
                    Key={"user_id": user_id},
                    UpdateExpression="SET request_count = :count, first_request_time = :time, #ttl_name = :ttl_value",
                    ExpressionAttributeNames={
                        "#ttl_name": "ttl"  
                    },
                    ExpressionAttributeValues={
                        ":count": 1,
                        ":time": Decimal(current_time),
                        ":ttl_value": ttl_value
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
                UpdateExpression="SET request_count = request_count + :inc, #ttl_name = :ttl_value",
                ExpressionAttributeNames={
                    "#ttl_name": "ttl"  # Use expression attribute name for the reserved keyword
                },
                ExpressionAttributeValues={
                    ":inc": 1,
                    ":ttl_value": ttl_value
                },
            )
            return True, remaining - 1

        except ClientError as e:
            # Log the error but don't block the request on rate limit failures
            print(f"Error checking rate limit: {str(e)}")
            return True, 0

    def get_retry_after(self, sub):
        """
        Returns the ISO8601 timestamp when the user can retry after hitting the rate limit.
        """
        user_id = self._hash_sub(sub)

        try:
            response = self.table.get_item(Key={"user_id": user_id})
            item = response.get("Item", {})
            first_request_time = item.get("first_request_time")
            if first_request_time is not None:
                retry_after_ts = int(first_request_time) + self.period_seconds
                retry_after_time = datetime.fromtimestamp(retry_after_ts, tz=timezone.utc)
                retry_after_iso = retry_after_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
                return retry_after_iso
        except Exception as e:
            print(f"Error getting retry after time: {str(e)}")
            pass
        # fallback: use now + period_seconds
        retry_after_time = datetime.now(timezone.utc) + timedelta(seconds=self.period_seconds)
        retry_after_iso = retry_after_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        return retry_after_iso
