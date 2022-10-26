# dc-api-v2

![Build Status](https://github.com/nulib/dc-api-v2/actions/workflows/build.yml/badge.svg)

## Directory structure

```
.
├── docs/ - mkdocs-based API documentation
├── events/ - sample HTTP API Lambda events
├── src/
│   └── api/ - code that directly supports API requests
│       ├── request/ - code to wrap/transform/modify incoming queries
│       ├── response/ - code to transform OpenSearch responses into the proper result format
│       │   ├── iiif/ - iiif formatted response transformers
│       │   ├── opensearch/ - opensearch formatted response transformers
│       │   └── oai-pmh/ - oai-pmh formatted response transformers
│       ├── aws/ - lower-level code to interact with AWS resources and OpenSearch
│       └── handlers/ - minimal code required to bridge between API Gateway request and core logic
└── test/ - tests and test helpers
```

## Local development setup

### `samconfig.toml`

The configuration file that tells the `sam` command how to run and deploy the API is called `samconfig.toml`. There are two ways to get that file. From the local project root:

1. For local development only: `ln -s dev/samconfig.toml .`
2. If you need to be able to deploy: `ln -s /path/to/tfvars/dc-api/samconfig.toml .` (You will need to have a local working copy of the private `tfvars` repo first.)

Whichever you choose, the resulting file will be ignored by `git`.

### `env.json`

The `env.json` file contains environment variable values for the lambda functions defined in the API for use in local development. An initial (empty) version with all the names of the necessary variables is in `dev/env.json`. Copy (**do not symlink**) this file into the project root and customize it for your own environment. It will also be ignored by `git`.

Some of the values can be found as follows:

- `API_TOKEN_SECRET` - already defined; value has to exist but doesn't matter in dev mode
- `ELASTICSEARCH_ENDPOINT` - run the following command:
  ```
  aws secretsmanager get-secret-value \
    --secret-id dev-environment/config/meadow --query SecretString \
    --output text | jq -r '.index.index_endpoint | sub("^https?://";"")'
  ```
- `ENV_PREFIX` - The username and environment indicating which index to use. Usually your dev environment user prefix followed by `-dev` (e.g., `mbk-dev`), but if you want to use your test index or someone else's index, adjust the value accordingly.

## Running the API locally

To start the API in development mode, run the following commands:

```
rm -rf .aws-sam
sam local start-api --host 0.0.0.0 --log-file dc-api.log
```

The API will be available at:

- `http://localhost:3000` (from your dev environment)
- `http://USER_PREFIX.dev.library.northwestern.edu:3000` (from elsewhere)
  - Don't forget to [open port 3000](https://github.com/nulib/aws-developer-environment#convenience-scripts) if you want to access it remotely

## Running the API locally via our AWS dev domain

This will make the local environment live at: https://[NAME].dev.rdc.library.northwestern.edu:3002/search

```
docker run --rm -it -d \
  -e "UPSTREAM_DOMAIN=172.17.0.1" \
  -e "UPSTREAM_PORT=3000" \
  -e "PROXY_DOMAIN=$DEV_PREFIX.dev.rdc.library.northwestern.edu" \
  -v /home/ec2-user/.dev_cert/dev.rdc.cert.pem:/etc/nginx/certs/cert.pem \
  -v /home/ec2-user/.dev_cert/dev.rdc.key.pem:/etc/nginx/certs/key.pem \
  -p 3002:443 \
  outrigger/https-proxy:1.0
```
