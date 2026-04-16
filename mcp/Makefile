clean:
	rm -rf node_modules

node_modules:
	npm ci


dist/apps/mcp/lambda.js: node_modules
	npm run build
	cp apps/mcp/package.json dist/apps/mcp/

build: dist/apps/mcp/lambda.js

build-mcpFunction: clean dist/apps/mcp/lambda.js
	cp -r dist/apps/* $(ARTIFACTS_DIR)
