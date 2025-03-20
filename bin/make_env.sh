#!/bin/bash

get_secret() {
  local secret_name=$1
  local secret_value=$(aws secretsmanager get-secret-value --secret-id $secret_name --query SecretString --output text)

  local key_name=$2
  if [ -n "$key_name" ]; then
    jq -r ".$key_name" <<< $secret_value
  else
    echo $secret_value
  fi
}

aws_account_id=$(aws sts get-caller-identity --query 'Account' --output text)
media_convert_endpoint=$(aws mediaconvert describe-endpoints --query 'Endpoints[0].Url' --output text)
media_convert_queue=$(aws mediaconvert get-queue --name Default --query Queue.Name --output text)

cat <<EOF > env.json
{
  "Parameters": {
    "AWS_REGION": "us-east-1",
    "API_TOKEN_NAME": "dcApiLocal",
    "API_TOKEN_SECRET": "$(get_secret staging/config/dcapi api_token_secret)",
    "DC_API_ENDPOINT": "https://${DEV_PREFIX}.dev.rdc.library.northwestern.edu:3002",
    "DC_URL": "https://${DEV_PREFIX}.dev.rdc.library.northwestern.edu:3001",
    "DEFAULT_SEARCH_SIZE": "10",
    "DEV_TEAM_NET_IDS": "$(aws ec2 describe-tags --filters "Name=resource-id,Values=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)" "Name=key,Values=NetID" --query 'Tags[0].Value' --output text)",
    "ENV_PREFIX": "${DEV_PREFIX}-${DEV_ENV}",
    "READING_ROOM_IPS": "",
    "SECRETS_PATH": "dev-environment",
    "AV_DOWNLOAD_EMAIL_TEMPLATE": "av-download-template",
    "AV_DOWNLOAD_STATE_MACHINE_ARN": "arn:aws:states:us-east-1:123456789012:stateMachine:hlsStitcherStepFunction",
    "GET_DOWNLOAD_LINK_FUNCTION": "arn:aws:lambda:us-east-1:123456789012:function:getDownloadLinkFunction",
    "MEDIA_CONVERT_DESTINATION_BUCKET": "${DEV_PREFIX}-${DEV_ENV}-streaming",
    "MEDIA_CONVERT_ENDPOINT": "${media_convert_endpoint}",
    "MEDIA_CONVERT_JOB_QUEUE_ARN": "${media_convert_queue}",
    "MEDIA_CONVERT_ROLE_ARN": "arn:aws:iam::${aws_account_id}:role/service-role/MediaConvert_Default_Role",
    "PYRAMID_BUCKET": "${DEV_PREFIX}-${DEV_ENV}-pyramids",
    "REPOSITORY_EMAIL": "repository@northwestern.edu",
    "SEND_TEMPLATED_EMAIL_FUNCTION": "arn:aws:lambda:us-east-1:123456789012:function:sendTemplatedEmailFunction",
    "START_AUDIO_TRANSCODE_FUNCTION": "arn:aws:lambda:us-east-1:123456789012:function:startAudioTranscodeFunction",
    "START_TRANSCODE_FUNCTION": "arn:aws:lambda:us-east-1:123456789012:function:startTranscodeFunction",
    "STEP_FUNCTION_ENDPOINT": "http://172.17.0.1:8083",
    "STREAMING_BUCKET": "${DEV_PREFIX}-${DEV_ENV}-streaming",
    "TRANSCODE_STATUS_FUNCTION": "arn:aws:lambda:us-east-1:123456789012:function:transcodeStatusFunction"
  }
}
EOF
