FROM oven/bun:1
LABEL io.modelcontextprotocol.server.name="io.github.nulib/dc-api"
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN PUBLISHING=true bun run ./build.ts
CMD ["bun", "run", "--silent", "stdio"]
