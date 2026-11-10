FROM public.ecr.aws/lambda/nodejs:24 AS model
ARG MODEL_REPOSITORY=onnx-community/embeddinggemma-2-ONNX
ARG MODEL_REVISION=main
ARG MODEL_FILE=model
WORKDIR /opt/models/${MODEL_REPOSITORY}
# Text tower only: the tokenizer, the model config and one ONNX graph with
# its external weights. The full-precision graph is the one Meadow embeds
# documents with; on CPU it is also several times faster per query than the
# quantized exports, at the cost of a larger image and more memory.
RUN mkdir -p onnx && \
    for file in config.json tokenizer.json tokenizer_config.json \
                onnx/${MODEL_FILE}.onnx onnx/${MODEL_FILE}.onnx_data; do \
      curl -fsSL --retry 3 -o "${file}" \
        "https://huggingface.co/${MODEL_REPOSITORY}/resolve/${MODEL_REVISION}/${file}" || exit 1; \
    done

FROM public.ecr.aws/lambda/nodejs:24
ARG MODEL_REPOSITORY=onnx-community/embeddinggemma-2-ONNX
ENV EMBEDDING_MODEL_PATH=/opt/models \
    EMBEDDING_MODEL_REPOSITORY=${MODEL_REPOSITORY} \
    EMBEDDING_MODEL_DTYPE=fp32
COPY --from=model /opt/models /opt/models
COPY package.json package-lock.json ${LAMBDA_TASK_ROOT}/
RUN cd ${LAMBDA_TASK_ROOT} && npm ci --omit=dev && npm cache clean --force
COPY index.mjs handler.mjs embedder.mjs ${LAMBDA_TASK_ROOT}/
CMD ["index.handler"]
