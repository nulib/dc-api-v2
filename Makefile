ifndef VERBOSE
.SILENT:
endif
ENV=dev
SHELL := /bin/bash

help:
	echo "make build                 | build the SAM project"
	echo "make serve                 | alias for serve-https"
	echo "make clean                 | remove all installed dependencies and build artifacts"
	echo "make deps                  | install all dependencies"
	echo "make env.json 						 | create an env.json file for the current user's environment"
	echo "make link                  | create hard links to allow for hot reloading of a built project"
	echo "make secrets               | symlink secrets files from ../tfvars"
	echo "make start-with-step       | run the SAM server locally with step function & download lambdas"
	echo "make style                 | run all style checks"
	echo "make test                  | run all tests"
	echo "make cover                 | run all tests with coverage"
	echo "make env ENV=[env]         | activate env.\$$ENV.json file (default: dev)"
	echo "make deps-node             | install node dependencies"
	echo "make deps-python           | install python dependencies"
	echo "make samconfig.NAME.yaml"  | create a user samconfig file for the specified username"
	echo "make build								 | build the SAM project for deploying"
	echo "make deploy                | deploy the SAM project to AWS"
	echo "make sync                  | sync the SAM project to AWS for quick development"
	echo "make sync-code             | sync the SAM project to AWS (code changes only)"
	echo "make serve-http            | run the SAM server locally (HTTP on port 3000)"
	echo "make serve-https           | run the SAM server locally (HTTPS on port 3002)"
	echo "make style-node            | run node code style check"
	echo "make style-python          | run python code style check"
	echo "make test-node             | run node tests"
	echo "make test-python           | run python tests"
	echo "make cover-node            | run node tests with coverage"
	echo "make cover-python          | run python tests with coverage"

.aws-sam/build.toml: ./template.yaml api/package-lock.json api/src/package-lock.json chat/dependencies/requirements.txt chat/src/requirements.txt
	sed -Ei.orig 's/"dependencies"/"devDependencies"/' api/src/package.json
	cp api/src/package-lock.json api/src/package-lock.json.orig
	cd api/src && npm i --package-lock-only && cd -
	for d in . api av-download chat docs ; do \
		sed -Ei.orig 's/^(\s+)#\*\s/\1/' $$d/template.yaml; \
	done

	-sam build --cached --parallel

	for d in . api av-download chat docs ; do \
		mv $$d/template.yaml.orig $$d/template.yaml; \
	done
	mv api/src/package.json.orig api/src/package.json
	mv api/src/package-lock.json.orig api/src/package-lock.json
layers/ffmpeg/bin/ffmpeg:
	mkdir -p av-download/layers/ffmpeg/bin ;\
	curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | \
	tar -C layers/ffmpeg/bin -xJ --strip-components=1 --wildcards '*/ffmpeg' '*/ffprobe'
deps-api:
	cd api/src ;\
	npm list >/dev/null 2>&1 ;\
	src_deps=$$? ;\
	cd .. ;\
	npm list >/dev/null 2>&1 ;\
	dev_deps=$$? ;\
	test $$src_deps -eq 0 -a $$dev_deps -eq 0 || npm ci
deps-av-download:
	cd av-download/lambdas ;\
	npm list >/dev/null 2>&1 || npm ci
deps-node: deps-api deps-av-download
cover-node: deps-node
	cd api && npm run test:coverage
style-node: deps-node
	cd api && npm run prettier
test-node: deps-node
	cd api && npm run test
deps-python:
	cd chat/src && pip install -r requirements.txt && pip install -r requirements-dev.txt
cover-python: deps-python
	cd chat && coverage run --source=src -m pytest -v && coverage report --skip-empty
cover-html-python: deps-python
	cd chat && coverage run --source=src -m pytest -v && coverage html --skip-empty
style-python: deps-python
	cd chat && ruff check . 
style-python-fix: deps-python
	cd chat && ruff check --fix . 
test-python: deps-python
	cd chat && pytest
python-version:
	cd chat && python --version
build: layers/ffmpeg/bin/ffmpeg .aws-sam/build.toml
serve-http: deps-node
	@printf '\033[0;31mWARNING: Serving only the local HTTP API. The chat websocket API is not available in local mode.\033[0m\n'
	rm -rf .aws-sam
	sam local start-api -t api/template.yaml --env-vars $$PWD/env.json --host 0.0.0.0 --log-file dc-api.log ${SERVE_PARAMS}
serve-https: SERVE_PARAMS = --port 3002 --ssl-cert-file $$HOME/.dev_cert/dev.rdc.cert.pem --ssl-key-file $$HOME/.dev_cert/dev.rdc.key.pem
serve-https: serve-http
serve: serve-https
start-with-step: deps-node env.json
	export AWS_DEFAULT_REGION=us-east-1 ;\
	sam local start-lambda --warm-containers=LAZY -t av-download/template.yaml --host 0.0.0.0 --port 3005 --env-vars $$PWD/env.json --log-file lambda.log & \
	echo $$! > .sam-pids ;\
	sg open all 3005 ;\
	sam local start-api --warm-containers=LAZY -t api/template.yaml --env-vars $$PWD/env.json --host 0.0.0.0 --port 3002 --log-file dc-api.log \
		--ssl-cert-file $$HOME/.dev_cert/dev.rdc.cert.pem --ssl-key-file $$HOME/.dev_cert/dev.rdc.key.pem & \
	echo $$! >> .sam-pids ;\
	docker run --rm -p 8083:8083 -e LAMBDA_ENDPOINT=http://172.17.0.1:3005/ amazon/aws-stepfunctions-local ;\
	echo -n "Shutting down..." ;\
	sg close all 3005 ;\
	kill $$(cat .sam-pids) ;\
	rm -f .sam-pids ;\
	echo ""
state-machine:
	export TEMPLATE_DIR=$$(mktemp -d); \
	yq -o=json '.Resources.avDownloadStateMachine.Properties.Definition' av-download/template.yaml > $$TEMPLATE_DIR/av_download.json; \
	aws stepfunctions create-state-machine --endpoint http://localhost:8083 --definition file://$$TEMPLATE_DIR/av_download.json --name "hlsStitcherStepFunction" --role-arn arn:aws:iam::012345678901:role/DummyRole --no-cli-pager
deps: deps-node deps-python
style: style-node style-python
test: test-node test-python
cover: cover-node cover-python
env.json:
	./bin/make_env.sh
samconfig.%.yaml:
	DEV_PREFIX=$* ./bin/make_deploy_config.sh
deploy: build samconfig.$(DEV_PREFIX).yaml
	sam deploy --config-file samconfig.$(DEV_PREFIX).yaml --stack-name dc-api-$(DEV_PREFIX)
sync: samconfig.$(DEV_PREFIX).yaml
	sam sync --config-file samconfig.$(DEV_PREFIX).yaml --stack-name dc-api-$(DEV_PREFIX) --watch $(ARGS)
sync-code: ARGS=--code
sync-code: sync
secrets:
	ln -s ../tfvars/dc-api/*.yaml .
clean:
	rm -rf .aws-sam api/.aws-sam chat/.aws-sam av-download/.aws-sam api/node_modules api/src/node_modules chat/**/__pycache__ chat/.coverage chat/.ruff_cache
reset:
	for f in $$(find . -maxdepth 2 -name '*.orig'); do mv $$f $${f%%.orig}; done
