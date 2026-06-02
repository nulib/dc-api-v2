build:
	bun install && \
	bun build --target=node --outdir $(ARTIFACTS_DIR) --entry-naming [name].mjs --sourcemap=linked $(TARGET_FUNCTION).js

build-startAudioTranscodeFunction: TARGET_FUNCTION=start-audio-transcode
build-startAudioTranscodeFunction: build

build-startTranscodeFunction: TARGET_FUNCTION=start-transcode
build-startTranscodeFunction: build

build-transcodeStatusFunction: TARGET_FUNCTION=transcode-status
build-transcodeStatusFunction: build

build-getDownloadLinkFunction: TARGET_FUNCTION=get-download-link
build-getDownloadLinkFunction: build

build-sendTemplatedEmailFunction: TARGET_FUNCTION=send-templated-email
build-sendTemplatedEmailFunction: build
