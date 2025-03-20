# dc-api-v2

[![Main API Build Status](https://github.com/nulib/dc-api-v2/actions/workflows/test-node.yml/badge.svg)](https://github.com/nulib/dc-api-v2/actions/workflows/test-node.yml) [![Chat API Build Status](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml/badge.svg)](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml)

## Local development setup

### `env.json`

The `env.json` file contains environment variable values for the lambda functions defined in the API for use in local development. You can create an `env.json` file containing the values to run the API against your dev data by running:

```shell
make env.json
```

If the file already exists, it will not be overwritten unless you include `-B` in the make command.

## Running the API locally

To start the API in development mode, first make sure you have the correct version of the AWS SAM command line utility installed:

```shell
asdf install aws-sam-cli
```

Then run the following command:

```shell
make serve
```

The API will be available at:

- `https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002`
  - Don't forget to [open port 3002](https://github.com/nulib/aws-developer-environment#convenience-scripts) if you want to access it remotely

⚠️ Note the above URLs (which point to your local OpenSearch instance) need _full endpoints_ to resolve. For example:

- `https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002/search`
- `https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002/collections`

[View supported endpoints](https://api.dc.library.northwestern.edu/docs/v2/spec/openapi.html) Questions? [View the production API documentation](https://api.dc.library.northwestern.edu/)

## Example workflows

### Meadow

View and edit information about a specific Work in the Index.

1. Open a local Meadow instance.
2. Find an `id` of a Work you'd like to inspect in the API.
3. View JSON response at `https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002/works/[WORK_ID]`
4. View IIIF Manifest JSON response at `https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002/works/[WORK_ID]?as=iiif`

For help debugging/inspecting, JavaScript `console` messages are written to: `dc-api-v2/dc-api.log`

### DC

Develop against changes to the API.

1. Before starting the DC app, temporarily change the port number in `dc-nextjs/server.js` from default `3000` to something like `3003`.
2. Open the port so it can be accessed in the browser.

```
sg open all 3003
```

3. Point to the proxy URL and start DC app (in your `/environment/dc-nextjs` shell)

```
export NEXT_PUBLIC_DCAPI_ENDPOINT=https://USER_PREFIX.dev.rdc.library.northwestern.edu:3002
npm run dev
```

Access the app in a browser at: https://USER_PREFIX.dev.rdc.library.northwestern.edu:3003/

## Running the API locally with state machine + lambdas (needed for AV download route)

```shell
# From the repo root
cd dc-api-v2

# Start the API + step function and associated lambdas
make start-with-step

# Open a second terminal and create the state machine
make state-machine
```

## Deploying a development branch

There are two ways to deploy a development branch: `make deploy` and `make sync`. The differences are:

- **Changes:** `deploy` deploys a static stack, and requires another `deploy` to update it. `sync` watches for
  changes in realtime.
- **Dependencies:** `deploy` uses the `apiDependencies` resource defined in the template for dependencies, while
  `sync` uses the AWS SAM CLI's built-in development dependency logic.

Either way, the resulting stack will be accessible at `https://dcapi-USER_PREFIX.rdc-staging.library.northwestern.edu`.

An existing `sync` stack can be reused by running `make sync` again, or by running `make sync-code` to only
sync code changes (no infrastructure/template changes).

### `samconfig.*.yaml`

Both methods involve a `samconfig.USER_PREFIX.yaml` file. This file, with default values, can be created by
running (for example):

```shell
make samconfig.mbk.yaml
```

This will create a configuration to stand up the default stacks in both `deploy` mode (API, AV Download, and Chat) and
`sync` mode (Chat only). To deploy a different combination of features, specify them using the `WITH` option:

```shell
make samconfig.mbk.yaml WITH=API,DOCS
```

Available features are: `API`, `AV_DOWNLOAD`, `CHAT`, and `DOCS`. 

⚠️ Be **very** careful including the API in `sync` mode as every change within `/api` will take a long time to deploy.

As with the `env.json` file, `make` will not overwrite an existing file unless you include `-B`.

### Tearing down a development stack

```shell
sam delete --stack-name dc-api-USER_PREFIX
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
   cd docs
   python -m venv ./.venv
   pip install -r requirements.txt
   sg open all 8000
   mkdocs serve -a 0.0.0.0:8000
   ```
   Docs will be accessible at http://USER_PREFIX.dev.rdc.library.northwestern.edu:8000/

### OpenAPI/Swagger Docs

We also maintain an OpenAPI Specification under the docs directory in [`spec/openapi.yaml`](docs/docs/spec/openapi.yaml). When `mkdocs` is running, the Swagger UI can be found at http://USER_PREFIX.dev.rdc.library.northwestern.edu:8000/spec/openapi.html. Like the rest of the documentation, changes to the YAML will be immediately visible in the browser.

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
