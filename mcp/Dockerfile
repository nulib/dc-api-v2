FROM node:24-alpine
LABEL io.modelcontextprotocol.server.name="io.github.nulib/dc-api"
WORKDIR /app
COPY . .
RUN npm ci
CMD ["npm", "run", "--silent", "stdio"]