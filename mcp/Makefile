build-mcpFunction:
	rm -rf node_modules
	npm ci
	npm run build
	cp -r dist/apps/* $(ARTIFACTS_DIR)
