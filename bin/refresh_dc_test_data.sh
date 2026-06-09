#!/bin/bash

REQUEST_SIZE=${REQUEST_SIZE:-10000}
TEST_PREFIX="dc-test-dc-v2-"
PROD_PREFIX="dc-v2-"

set -e

update_test_index() {
  local index=$1
  echo "Updating index: $index"
  TEST_INDEX=${TEST_PREFIX}${index}
  PROD_INDEX=${PROD_PREFIX}${index}

  echo -n "Retrieving test IDs..."
  ids=$(curl -s "http://localhost:9201/${TEST_INDEX}/_search?size=$REQUEST_SIZE&_source=id" | jq '[.hits.hits[]._id]')
  echo "Found $(echo "$ids" | jq 'length') IDs to update."

  echo "Building query..."
  query=$(jq -nc --argjson ids "$ids" --arg size "$REQUEST_SIZE" '{ "size": $size, "query": { "terms": { "id": $ids } } }')

  echo -n "Retrieving docs from production..."
  docs=$(curl -s -X POST "http://localhost:9202/${PROD_INDEX}/_search" -H 'Content-Type: application/json' -d "$query")
  echo "Retrieved $(echo "$docs" | jq '.hits.hits | length') documents."

  echo "Building bulk request..."
  timestamp=$(date +%s%3N)
  bulk=$(echo "$docs" | jq --arg test_index "$TEST_INDEX-$timestamp" -r '
    .hits.hits[] |
    ({"index": {"_index": $test_index, "_id": ._id}} | tojson),
    (._source | tojson)
  ')
  bulk_file=$(mktemp)
  echo "$bulk" > "$bulk_file"

  echo "Getting index settings..."
  settings=$(curl -s "http://localhost:9202/${PROD_INDEX}" | jq '. | to_entries | .[0].value' | jq 'del(.aliases, .settings.index.creation_date, .settings.index.uuid, .settings.index.version, .settings.index.provided_name, .settings.index.default_pipeline)')

  if [[ -n "$UPDATE" ]]; then
    echo "Creating new index ${TEST_INDEX}-${timestamp}..."
    curl -s -X PUT "http://localhost:9201/${TEST_INDEX}-${timestamp}" -H 'Content-Type: application/json' -d "$settings"
    echo ""

    echo "Adding test data..."
    curl -s -X POST "http://localhost:9201/${TEST_INDEX}-${timestamp}/_bulk" \
      -H 'Content-Type: application/x-ndjson' \
      --data-binary "@$bulk_file"
    echo ""
    rm "$bulk_file"

    echo "Retargeting alias ${TEST_INDEX} to new index..."
    old_index=$(curl -s "http://localhost:9201/_alias/${TEST_INDEX}" | jq -r 'keys[0]')

    curl -s -X POST 'http://localhost:9201/_aliases' -H 'Content-Type: application/json' -d @- <<EOF
    {
      "actions": [
        { "remove": { "index": "$old_index", "alias": "${TEST_INDEX}" } },
        { "add":    { "index": "${TEST_INDEX}-${timestamp}", "alias": "${TEST_INDEX}" } }
      ]
    }
EOF
    echo ""
  else
    mkdir -p test-data
    echo "$bulk" > test-data/$index.ndjson
    echo "$settings" > test-data/$index-settings.json
    echo "Dry run complete. Re-run with UPDATE=1 to perform the update."
  fi
}

setup() {
  echo "Setting up..."
  PORT=9201 AWS_PROFILE=staging es-proxy start
  PORT=9202 AWS_PROFILE=production es-proxy start
}

cleanup() {
  echo "Cleaning up..."
  PORT=9201 AWS_PROFILE=staging es-proxy stop
  PORT=9202 AWS_PROFILE=production es-proxy stop
}
trap cleanup EXIT
setup
for index in collection work file-set; do
  update_test_index $index
done
