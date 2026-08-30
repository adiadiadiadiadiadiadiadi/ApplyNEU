# syntax=docker/dockerfile:1

# One image, two processes: the API and the BullMQ worker differ only by command.
FROM node:24-slim

WORKDIR /app

# Deps first — this layer stays cached until package.json/package-lock.json change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# tsconfig.json is required at runtime: tsx reads it for module resolution.
COPY tsconfig.json swagger_output.json ./
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 8080
USER node

# API is the default; the worker overrides this command (see docker-compose.yml).
CMD ["node", "--import", "tsx", "src/app.ts"]
