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

⚠️ Note the above URLs (which point to your local OpenSearch instance) need _full endpoints_ to resolve. For example:

- `http://USER_PREFIX.dev.library.northwestern.edu:3000/search`
- `http://USER_PREFIX.dev.library.northwestern.edu:3000/collections`

[View supported endpoints](https://api.dc.library.northwestern.edu/docs/v2/spec/openapi.html) Questions? [View the production API documention](https://api.dc.library.northwestern.edu/)

## Running the API locally via our AWS dev domain

Use the [https-proxy](https://github.com/nulib/aws-developer-environment#convenience-scripts) script to make the local environment live at: https://[DEV_PREFIX].dev.rdc.library.northwestern.edu:3002/search

```
https-proxy start 3002 3000
```

## Example workflows

### Meadow

View and edit information about a specific Work in the Index.

1. Open a local Meadow instance.
2. Find an `id` of a Work you'd like to inspect in the API.
3. View JSON response at `http://USER_PREFIX.dev.library.northwestern.edu:3000/works/[WORK_ID]`
4. View IIIF Manifest JSON response at `http://USER_PREFIX.dev.library.northwestern.edu:3000/works/[WORK_ID]?as=iiif`

For help debugging/inspecting, JavaScript `console` messages are written to: `dc-api-v2/dc-api.log`

### DC

Develop against changes to the API.

1. Before starting the DC app, temporarily change the port number in `dc-nextjs/server.js` from default `3000` to something like `3003`.
2. Open the port so it can be accessed in the browser.

```
sg open all 3003
```

3. Start the proxy for the API

```
https-proxy start 3002 3000
```

4. Point to the proxy URL and start DC app (in your `/environment/dc-nextjs` shell)

```
export NEXT_PUBLIC_DCAPI_ENDPOINT=https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002
npm run dev
```

Access the app in a browser at: https://USER_PREFIX.dev.rdc.library.northwestern.edu:3003/

## Running the API locally with state machine + lambdas (needed for AV download route)

```shell
# From the repo root
cd dc-api-v2

#  Make sure you've done an `npm install` recently to update any packages in the `lambdas` directory
npm install

# Start the proxy (if needed)
https-proxy start 3002 3000

# Open port 3005 (if needed)
sg open all 3005

# Login as the staging-admin user
export AWS_PROFILE=staging-admin
aws sso login

# Start the API + step function and associated lambdas
bin/start-with-step

# Open a second terminal and create the state machine
aws stepfunctions create-state-machine --endpoint http://localhost:8083 --definition file://state_machines/av_download.json --name "hlsStitcherStepFunction" --role-arn arn:aws:iam::012345678901:role/DummyRole
```



## Deploying the API manually

- Symlink the `*.parameters` file you need from `tfvars/dc-api/` to the application root
- Set your `CONFIG_ENV` and `HONEYBADGER_REVISION` environment variables
- Run `sam deploy`

```sh
# staging environment example:

ln -s ~/environment/tfvars/dc-api/staging.parameters .
CONFIG_ENV=staging
HONEYBADGER_REVISION=$(git rev-parse HEAD)
sam deploy \
  --config-env $CONFIG_ENV \
  --config-file ./samconfig.toml \
  --parameter-overrides $(while IFS='=' read -r key value; do params+=" $key=$value"; done < ./$CONFIG_ENV.parameters && echo "$params HoneybadgerRevision=$HONEYBADGER_REVISION")
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

## DC API Typescript NPM package

Typescript types for the schemas (Works, Collections, FileSets) are automatically published to the [nulib/dcapi-types](https://github.com/nulib/dcapi-types) repo on deploys.

- If a deploy to the `deploy/staging` branch contains changes to the `docs/docs/spec/data-types.yaml` file, new types are generated and a commit is made to the `staging` branch of `nulib/dcapi`. This is intended to be for local testing by NUL devs against the private staging API.
- If a deploy to production (`main` branch) contains changes to the `docs/docs/spec/data-types.yaml` file, new types are generated and a PR is opened into the `main` branch of `nulib/dcapi-types`. Also, an issue is created in `nulib/repodev_planning_and_docs` to review the PR and publish the types package (manually).
