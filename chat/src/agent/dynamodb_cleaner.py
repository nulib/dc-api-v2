import os
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

def delete_checkpoint(thread_id, region_name=os.getenv("AWS_REGION")):
    """
    Deletes all items with the specified thread_id from the checkpoint
    DynamoDB tables.
    
    :param thread_id: The thread_id value to delete.
    :param region_name: AWS region where the table is hosted.
    """
    for table_var in ["CHECKPOINT_TABLE", "CHECKPOINT_WRITES_TABLE"]:
      delete_thread(os.getenv(table_var), thread_id, region_name)

def delete_thread(table_name, thread_id, region_name=os.getenv("AWS_REGION")):
    """
    Deletes all items with the specified thread_id from the DynamoDB table.

    :param table_name: Name of the DynamoDB table.
    :param thread_id: The thread_id value to delete.
    :param region_name: AWS region where the table is hosted.
    """
    # Initialize a session using Amazon DynamoDB
    session = boto3.Session(region_name=region_name)
    dynamodb = session.resource('dynamodb')
    table = dynamodb.Table(table_name)

    try:
        # Query the table for all items with the given thread_id
        response = table.query(
            KeyConditionExpression=Key('thread_id').eq(thread_id)
        )

        items = response.get('Items', [])

        # Continue querying if there are more items (pagination)
        while 'LastEvaluatedKey' in response:
            response = table.query(
                KeyConditionExpression=Key('thread_id').eq(thread_id),
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items.extend(response.get('Items', []))

        if not items:
            print(f"No items found with thread_id: {thread_id}")
            return

        # Prepare delete requests in batches of 25 (DynamoDB limit for BatchWriteItem)
        with table.batch_writer() as batch:
            for item in items:
                key = {
                    'thread_id': item['thread_id'],
                    'sort_key': item['sort_key']  # Ensure you use the correct sort key name
                }
                batch.delete_item(Key=key)

        print(f"Successfully deleted {len(items)} items with thread_id: {thread_id}")

    except ClientError as e:
        print(f"An error occurred: {e.response['Error']['Message']}")
