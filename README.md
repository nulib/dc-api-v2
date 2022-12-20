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

Use the [https-proxy](https://github.com/nulib/aws-developer-environment#convenience-scripts) script to make the local environment live at: https://[DEV_PREFIX].dev.rdc.library.northwestern.edu:3002/search

```
https-proxy start 3002 3000
```

## Writing Documentation

API documentation is automatically regenerated and deployed on pushes to the staging and production branches. The documentation is in two parts:

### Regular Docs

The `docs` directory contains a standard `mkdocs` project, which can be edited using the same tools and format as the main [Repository Documentation](http://docs.rdc.library.northwestern.edu/#contributing).

In a nutshell:

1. Clone this project into a working directory (which you probably already have).
2. Edit the Markdown files in the `docs/docs` directory.
3. To run `mkdocs` locally and preview your work:
   ```shell
   pip install poetry # only has to be done once
   cd docs
   poetry install
   sg open all 8000
   poetry run mkdocs serve -a 0.0.0.0:8000
   ```
   Docs will be accessible at http://[DEV_PREFIX].dev.rdc.library.northwestern.edu:8000/

### OpenAPI/Swagger Docs

We also maintain an OpenAPI Specification under the docs directory in [`spec/openapi.yaml`](docs/docs/spec/openapi.yaml). When `mkdocs` is running, the Swagger UI can be found at http://[DEV_PREFIX].dev.rdc.library.northwestern.edu:8000/spec/openapi.html. Like the rest of the documentation, changes to the YAML will be immediately visible in the browser.

The existing spec files ([`openapi.yaml`](docs/docs/spec/openapi.yaml) and [`types.yaml`](docs/docs/spec/types.yaml)) are the best reference for understanding and updating the spec. It's especially important to understand how `openapi.yaml` uses the [`$ref` keyword](https://swagger.io/docs/specification/using-ref/) to refer to reusable elements defined in `types.yaml`.

For an in-depth look, or to learn how to define things for which there aren't good examples in our spec, refer to the [full OpenAPI documentation](https://swagger.io/docs/specification/).

#### Build Artifacts

`openapi.html` renders the Swagger UI directly from the unmodified `openapi.yaml`. In addition, the build process generates a JSON copy of the spec using the [OpenAPI Generator CLI](https://openapi-generator.tech). In order to make sure the spec is valid before checking it in, run:
```shell
npm run validate-spec
```
This check is also part of the CI test workflow, so an invalid spec file will cause the branch to fail CI.
