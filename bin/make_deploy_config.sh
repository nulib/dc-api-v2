#!/bin/bash

CMD_WITH=$WITH

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

with() {
  local feature=$1
  if [[ ",$WITH," == *",$feature,"* ]]; then
    echo "true"
  else
    echo "false"
  fi
}

aws_account_id=$(aws sts get-caller-identity --query 'Account' --output text)
net_id=$(aws ec2 describe-tags \
  --filters "Name=resource-id,Values=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)" \
            "Name=key,Values=NetID" \
  --query 'Tags[0].Value' \
  --output text)
nusso_config=$(get_secret dev-environment/infrastructure/nusso)
cat <<EOF > samconfig.${DEV_PREFIX}.yaml
---
version: 1.0
default:
EOF

for section in deploy sync; do
  case $section in
    deploy)
      WITH=${CMD_WITH:-"API,AV_DOWNLOAD,CHAT"}
      ;;
    sync)
      WITH=${CMD_WITH:-"CHAT"}
      ;;
  esac
  cat <<EOF >> samconfig.${DEV_PREFIX}.yaml
  ${section}:
    parameters:
      stack_name: dc-api-${DEV_PREFIX}
      s3_bucket: $(aws s3api list-buckets --query "Buckets[?starts_with(Name, 'aws-sam-cli-managed')].{Name:Name, CreationDate:CreationDate}" --output json | jq -r 'sort_by(.CreationDate) | .[0].Name')
      s3_prefix: dc-api-${DEV_PREFIX}
      region: us-east-1
      confirm_changeset: true
      capabilities:
        - CAPABILITY_IAM
        - CAPABILITY_AUTO_EXPAND
      image_repositories: []
      parameter_overrides: >
        ApiConfigPrefix="dev-environment-${DEV_PREFIX}"
        ApiTokenName="dcapi$(openssl rand -hex 4 | cut -c1-7)"
        ApiTokenSecret="$(get_secret staging/config/dcapi api_token_secret)"
        CustomDomainCertificateArn="$(aws acm list-certificates --query "CertificateSummaryList[?DomainName=='*.rdc-staging.library.northwestern.edu'].CertificateArn" --output text)"
        CustomDomainHost="dcapi-${DEV_PREFIX}"
        CustomDomainZone="rdc-staging.library.northwestern.edu"
        DcApiEndpoint="https://dcapi-${DEV_PREFIX}.rdc-staging.library.northwestern.edu/api/v2"
        DcUrl="https://dc.rdc-staging.library.northwestern.edu"
        DeployAPI="$(with API)"
        DeployAVDownload="$(with AV_DOWNLOAD)"
        DeployChat="$(with CHAT)"
        DeployDocs="$(with DOCS)"
        DevTeamNetIds="${net_id}"
        ElasticsearchEndpoint="$(get_secret dev-environment/infrastructure/index | jq -r '.endpoint | ltrimstr("https://")')"
        EnvironmentPrefix="${DEV_PREFIX}-${DEV_ENV}"
        MediaConvertDestinationBucket="${DEV_PREFIX}-${DEV_ENV}-streaming"
        MediaConvertEndpoint="$(aws mediaconvert describe-endpoints --query 'Endpoints[0].Url' --output text)"
        MediaConvertJobQueueArn="arn:aws:mediaconvert:us-east-1:${aws_account_id}:queues/Default"
        MediaConvertRoleArn="arn:aws:iam::${aws_account_id}:role/service-role/MediaConvert_Default_Role"
        NussoApiKey="$(jq -r '.api_key' <<< $nusso_config)"
        NussoBaseUrl="$(jq -r '.base_url' <<< $nusso_config)"
        PyramidBucket="${DEV_PREFIX}-${DEV_ENV}-pyramids"
        ReadingRoomIPs=""
        RepositoryEmail="repository@northwestern.edu"
        SecretsPath="dev-environment"
        StreamingBucket="${DEV_PREFIX}-${DEV_ENV}-streaming"
EOF
done