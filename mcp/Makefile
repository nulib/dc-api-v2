build:
	rm -rf node_modules
	npm ci
	npm run build

build-mcpFunction: build
	cp -r dist/apps/* apps/mcp/package.json $(ARTIFACTS_DIR)
