# C2PA signing rests on native addons, which can't be bundled. They're left as
# runtime imports and installed next to the bundle for the Lambda platform,
# whatever the build host is.
C2PA_EXTERNAL := @nulib/c2pa-signing @contentauth/c2pa-node sharp
C2PA_NODE_REPO := https://github.com/contentauth/c2pa-js
LAMBDA_OS := linux
LAMBDA_CPU := x64

node_modules:
	bun install

build-apiFunction: node_modules
	bun build --target node --outdir $(ARTIFACTS_DIR) --entry-naming [name].mjs --sourcemap=linked $(foreach pkg,$(C2PA_EXTERNAL),--external $(pkg)) src/index.ts
	jq '{private: true, dependencies: .optionalDependencies, trustedDependencies: ["sharp"]}' package.json > $(ARTIFACTS_DIR)/package.json
	cd $(ARTIFACTS_DIR) && bun install --production --os $(LAMBDA_OS) --cpu $(LAMBDA_CPU) && rm -rf bun.lock node_modules/@img/*musl*
	TMPDIR=$$(mktemp -d) && \
	VERSION=$$(jq -r '.version' $(ARTIFACTS_DIR)/node_modules/@contentauth/c2pa-node/package.json) && \
	curl -fLso $${TMPDIR}/c2pa-node.zip $(C2PA_NODE_REPO)/releases/download/%40contentauth%2Fc2pa-node%40$${VERSION}/c2pa-node_x86_64-unknown-linux-gnu-v$${VERSION}.zip && \
	unzip -o -d $(ARTIFACTS_DIR)/node_modules/@contentauth/c2pa-node/dist $${TMPDIR}/c2pa-node.zip && \
	rm -rf $${TMPDIR}
