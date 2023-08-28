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
	echo "make deps           | install dependencies"
	echo "make style          | run code style check"
	echo "make test           | run tests"
	echo "make cover          | run tests with coverage"
.aws-sam/build.toml: ./template.yaml node/package-lock.json node/src/package-lock.json python/requirements.txt python/src/requirements.txt
	sam build --cached --parallel
deps:
	cd node && npm ci
cover:
	cd node && npm run test:coverage
style:
	cd node && npm run prettier
test:
	cd node && npm run test
build: .aws-sam/build.toml
link: build
	cd node/src && for src in *.js *.json **/*.js **/*.json; do for target in $$(find ../../.aws-sam/build -maxdepth 1 -type d); do if [[ -f $$target/$$src ]]; then ln -f $$src $$target/$$src; fi; done; done
serve: link
	sam local start-api --host 0.0.0.0 --log-file dc-api.log
env:
	ln -fs ./env.${ENV}.json ./env.json
secrets:
	ln -s ../tfvars/dc-api/* .
clean:
	rm -rf .aws-sam node/node_modules node/src/node_modules
