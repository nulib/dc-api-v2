ifndef VERBOSE
.SILENT:
endif
ENV=dev

help:
	echo "make build          | build the SAM project"
	echo "make serve          | run the SAM server locally"
	echo "make clean          | remove all installed dependencies and build artifacts"
	echo "make deps           | install all dependencies"
	echo "make link           | create hard links to allow for hot reloading of a built project"
	echo "make secrets        | symlink secrets files from ../tfvars"
	echo "make style          | run all style checks"
	echo "make test           | run all tests"
	echo "make cover          | run all tests with coverage"
	echo "make env ENV=[env]  | activate env.\$$ENV.json file (default: dev)"
	echo "make deps-node      | install node dependencies"
	echo "make deps-python    | install python dependencies"
	echo "make style-node     | run node code style check"
	echo "make style-python   | run python code style check"
	echo "make test-node      | run node tests"
	echo "make test-python    | run python tests"
	echo "make cover-node     | run node tests with coverage"
	echo "make cover-python   | run python tests with coverage"
.aws-sam/build.toml: ./template.yaml node/package-lock.json node/src/package-lock.json python/requirements.txt python/src/requirements.txt
	sam build --cached --parallel
deps-node:
	cd node && npm ci
cover-node:
	cd node && npm run test:coverage
style-node:
	cd node && npm run prettier
test-node:
	cd node && npm run test
deps-python:
	cd chat/src && pip install -r requirements.txt
cover-python:
	cd chat/src && coverage run --include='src/**/*' -m unittest -v && coverage report
style-python:
	cd chat && ruff check .
test-python:
	cd chat && python -m unittest -v
build: .aws-sam/build.toml
link: build
	cd chat/src && for src in *.py **/*.py; do for target in $$(find ../../.aws-sam/build -maxdepth 1 -type d); do if [[ -f $$target/$$src ]]; then ln -f $$src $$target/$$src; fi; done; done
	cd node/src && for src in *.js *.json **/*.js **/*.json; do for target in $$(find ../../.aws-sam/build -maxdepth 1 -type d); do if [[ -f $$target/$$src ]]; then ln -f $$src $$target/$$src; fi; done; done
serve: link
	sam local start-api --host 0.0.0.0 --log-file dc-api.log
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
