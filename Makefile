ifndef VERBOSE
.SILENT:
endif
ENV=dev
SHELL := /bin/bash

help:
	echo "make build           | build the SAM project"
	echo "make serve           | alias for serve-https"
	echo "make clean           | remove all installed dependencies and build artifacts"
	echo "make deps            | install all dependencies"
	echo "make link            | create hard links to allow for hot reloading of a built project"
	echo "make secrets         | symlink secrets files from ../tfvars"
	echo "make start-with-step | run the SAM server locally with step function & download lambdas"
	echo "make style           | run all style checks"
	echo "make test            | run all tests"
	echo "make cover           | run all tests with coverage"
	echo "make env ENV=[env]   | activate env.\$$ENV.json file (default: dev)"
	echo "make deps-node       | install node dependencies"
	echo "make deps-python     | install python dependencies"
	echo "make serve-http      | run the SAM server locally (HTTP on port 3000)"
	echo "make serve-https     | run the SAM server locally (HTTPS on port 3002)"
	echo "make style-node      | run node code style check"
	echo "make style-python    | run python code style check"
	echo "make test-node       | run node tests"
	echo "make test-python     | run python tests"
	echo "make cover-node      | run node tests with coverage"
	echo "make cover-python    | run python tests with coverage"
.aws-sam/build.toml: ./template.yaml node/package-lock.json node/src/package-lock.json chat/dependencies/requirements.txt chat/src/requirements.txt
	sed -Ei.orig 's/^(\s+)#\*\s/\1/' template.yaml
	sed -Ei.orig 's/^(\s+)#\*\s/\1/' chat/template.yaml
	sam build --cached --parallel
	mv template.yaml.orig template.yaml
	mv chat/template.yaml.orig chat/template.yaml
deps-node:
	cd node/src ;\
	npm list >/dev/null 2>&1 ;\
	src_deps=$$? ;\
	cd .. ;\
	npm list >/dev/null 2>&1 ;\
	dev_deps=$$? ;\
	test $$src_deps -eq 0 -a $$dev_deps -eq 0 || npm ci

	cd lambdas ;\
	npm list >/dev/null 2>&1 || npm ci
cover-node: deps-node
	cd node && npm run test:coverage
style-node: deps-node
	cd node && npm run prettier
test-node: deps-node
	cd node && npm run test
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
build: .aws-sam/build.toml
serve-http: deps-node
	@printf '\033[0;31mWARNING: Serving only the local HTTP API. The chat websocket API is not available in local mode.\033[0m\n'
	rm -rf .aws-sam
	sam local start-api --host 0.0.0.0 --log-file dc-api.log ${SERVE_PARAMS}
serve-https: SERVE_PARAMS = --port 3002 --ssl-cert-file $$HOME/.dev_cert/dev.rdc.cert.pem --ssl-key-file $$HOME/.dev_cert/dev.rdc.key.pem
serve-https: serve-http
serve: serve-https
start-with-step: deps-node
	sam local start-lambda --host 0.0.0.0 --port 3005 --env-vars env.json --log-file lambda.log & \
	echo $$! > .sam-pids ;\
	sam local start-api --host 0.0.0.0 --port 3002 --log-file dc-api.log \
		--ssl-cert-file $$HOME/.dev_cert/dev.rdc.cert.pem --ssl-key-file $$HOME/.dev_cert/dev.rdc.key.pem & \
	echo $$! >> .sam-pids ;\
	docker run --rm -p 8083:8083 -e LAMBDA_ENDPOINT=http://172.17.0.1:3005/ amazon/aws-stepfunctions-local ;\
	kill $$(cat .sam-pids) ;\
	rm -f .sam-pids
deps: deps-node deps-python
style: style-node style-python
test: test-node test-python
cover: cover-node cover-python
env:
	ln -fs ./env.${ENV}.json ./env.json
secrets:
	ln -s ../tfvars/dc-api/* .
clean:
	rm -rf .aws-sam node/node_modules node/src/node_modules python/**/__pycache__ python/.coverage python/.ruff_cache