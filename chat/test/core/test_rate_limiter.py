import pytest
import time
import os
from decimal import Decimal
from unittest.mock import patch, MagicMock

import boto3
from moto import mock_aws

from core.rate_limiter import RateLimiter


@pytest.fixture
def dynamodb_table():
    """Fixture to create a mock DynamoDB table for testing"""
    with mock_aws():
        os.environ["RATE_LIMIT_TABLE_NAME"] = "ChatApiRateLimits"

        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

        table = dynamodb.create_table(
            TableName="ChatApiRateLimits",
            KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "user_id", "AttributeType": "S"}],
            ProvisionedThroughput={"ReadCapacityUnits": 5, "WriteCapacityUnits": 5},
        )

        yield table


class TestRateLimiter:
    def test_init_default_values(self):
        """Test that the RateLimiter initializes with default values"""
        limiter = RateLimiter()
        assert limiter.max_requests == 200
        assert limiter.period_seconds == 7 * 24 * 60 * 60  # 7 days in seconds
        assert limiter.table_name == "ChatApiRateLimits"

    def test_init_custom_values(self):
        """Test that the RateLimiter initializes with custom values"""
        limiter = RateLimiter(max_requests=50, period_seconds=3600)  # 1 hour
        assert limiter.max_requests == 50
        assert limiter.period_seconds == 3600

    def test_hash_sub(self):
        """Test the _hash_sub method produces expected results"""
        limiter = RateLimiter()

        # Test with a valid string
        test_sub = "test@example.com"
        hashed = limiter._hash_sub(test_sub)
        assert isinstance(hashed, str)
        assert len(hashed) == 24

        # Test with uppercase (should be case-insensitive)
        test_sub_upper = "TEST@EXAMPLE.COM"
        hashed_upper = limiter._hash_sub(test_sub_upper)
        assert hashed_upper == hashed

        # Test with None
        assert limiter._hash_sub(None) is None

        # Test that the same input always produces the same hash
        assert limiter._hash_sub(test_sub) == limiter._hash_sub(test_sub)

        # Test different inputs produce different hashes
        assert limiter._hash_sub("different@example.com") != hashed

    def test_check_rate_limit_no_sub(self):
        """Test check_rate_limit with no sub provided"""
        limiter = RateLimiter(max_requests=100)
        is_allowed, remaining = limiter.check_rate_limit(None)
        assert is_allowed is False
        assert remaining == 0

        is_allowed, remaining = limiter.check_rate_limit("")
        assert is_allowed is False
        assert remaining == 0

    @mock_aws
    def test_check_rate_limit_first_request(self, dynamodb_table):
        """Test check_rate_limit for a first-time user"""
        limiter = RateLimiter(max_requests=100)

        # First request for a new user
        is_allowed, remaining = limiter.check_rate_limit("user1@example.com")

        assert is_allowed is True
        assert remaining == 99

        # Verify item was created in DynamoDB
        user_id = limiter._hash_sub("user1@example.com")
        response = dynamodb_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        assert item is not None
        assert item["user_id"] == user_id
        assert item["request_count"] == 1
        assert "first_request_time" in item
        assert "last_request_time" in item

    @mock_aws
    def test_check_rate_limit_under_limit(self, dynamodb_table):
        """Test check_rate_limit for a user under the limit"""
        limiter = RateLimiter(max_requests=100)
        user_id = limiter._hash_sub("user2@example.com")

        # Seed the table with existing data
        current_time = int(time.time())
        dynamodb_table.put_item(
            Item={
                "user_id": user_id,
                "request_count": 5,
                "first_request_time": Decimal(current_time - 1000),  # 1000 seconds ago
                "last_request_time": Decimal(current_time - 100),  # 100 seconds ago
            }
        )

        # Check rate limit
        is_allowed, remaining = limiter.check_rate_limit("user2@example.com")

        assert is_allowed is True
        assert remaining == 94  # max_requests - 5 - 1 (for current request)

        # Verify item was updated in DynamoDB
        response = dynamodb_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        assert item["request_count"] == 6
        # last_request_time should be updated
        assert item["last_request_time"] > Decimal(current_time - 100)

    @mock_aws
    def test_check_rate_limit_at_limit(self, dynamodb_table):
        """Test check_rate_limit for a user at the limit"""
        limiter = RateLimiter(max_requests=10)
        user_id = limiter._hash_sub("user3@example.com")

        # Seed the table with existing data (at the limit)
        current_time = int(time.time())
        dynamodb_table.put_item(
            Item={
                "user_id": user_id,
                "request_count": 10,
                "first_request_time": Decimal(current_time - 1000),
                "last_request_time": Decimal(current_time - 100),
            }
        )

        # Check rate limit
        is_allowed, remaining = limiter.check_rate_limit("user3@example.com")

        assert is_allowed is False
        assert remaining == 0

        # Verify item was NOT updated in DynamoDB (count should still be 10)
        response = dynamodb_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        assert item["request_count"] == 10
        assert item["last_request_time"] == Decimal(
            current_time - 100
        )  # Should not be updated

    @mock_aws
    def test_check_rate_limit_period_expired(self, dynamodb_table):
        """Test check_rate_limit for a user whose period has expired"""
        period_seconds = 3600  # 1 hour
        limiter = RateLimiter(max_requests=10, period_seconds=period_seconds)
        user_id = limiter._hash_sub("user4@example.com")

        # Seed the table with existing data (period has expired)
        current_time = int(time.time())
        old_time = current_time - (period_seconds + 100)  # 100 seconds past expiration

        dynamodb_table.put_item(
            Item={
                "user_id": user_id,
                "request_count": 10,  # User was at the limit
                "first_request_time": Decimal(old_time),
                "last_request_time": Decimal(old_time + 500),
            }
        )

        # Check rate limit
        is_allowed, remaining = limiter.check_rate_limit("user4@example.com")

        assert is_allowed is True
        assert remaining == 9  # max_requests - 1 (reset counter)

        # Verify item was updated in DynamoDB with reset counter
        response = dynamodb_table.get_item(Key={"user_id": user_id})
        item = response.get("Item")

        assert item["request_count"] == 1
        assert item["first_request_time"] > Decimal(old_time)
        assert item["last_request_time"] > Decimal(old_time + 500)

    @patch("boto3.resource")
    def test_check_rate_limit_client_error(self, mock_boto_resource):
        """Test check_rate_limit handles ClientError gracefully"""
        # Setup mock to raise ClientError
        mock_table = MagicMock()
        mock_table.get_item.side_effect = (
            boto3.exceptions.botocore.exceptions.ClientError(
                {"Error": {"Code": "InternalServerError", "Message": "Test error"}},
                "GetItem",
            )
        )

        mock_aws = MagicMock()
        mock_aws.Table.return_value = mock_table
        mock_boto_resource.return_value = mock_aws

        # Create rate limiter with mocked resources
        limiter = RateLimiter()

        # Check that it handles the error and returns True (doesn't block)
        with patch("builtins.print") as mock_print:
            is_allowed, remaining = limiter.check_rate_limit("user5@example.com")

            assert is_allowed is True
            assert remaining == 0
            mock_print.assert_called_once()  # Verify error was logged
