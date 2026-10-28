# syntax=docker/dockerfile:1
# One image: the Hono API on Bun + the built SPA (IMPLEMENTATION_PLAN.md §1).
# Build from the repo root: docker build -f docker/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) .

# Keep in sync with `packageManager` in package.json.
ARG BUN_VERSION=1.3.14

# Workspace manifests only, so dependency layers stay cached until they change.
FROM oven/bun:${BUN_VERSION}-alpine AS manifests
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# All dependencies, to build the web app.
FROM manifests AS build
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA=dev
# Read by vite.config.ts (Settings → App version).
ENV GIT_SHA=${GIT_SHA}
RUN bun run --filter @stryde/web build

# Production dependencies of the API (and the shared package it imports).
FROM manifests AS prod-deps
RUN bun install --frozen-lockfile --production --filter @stryde/api

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public \
    UPLOAD_DIR=/data/uploads
COPY --from=prod-deps --chown=bun:bun /app ./
# The API and shared package run from TypeScript source under Bun; migrations ship
# with the source and run on boot.
COPY --chown=bun:bun apps/api/src apps/api/src
COPY --chown=bun:bun apps/api/package.json apps/api/tsconfig.json apps/api/
COPY --chown=bun:bun packages/shared/src packages/shared/src
COPY --from=build --chown=bun:bun /app/apps/web/dist ./public
RUN mkdir -p /data/uploads && chown bun:bun /data/uploads
ARG GIT_SHA=dev
# Reported by /api/health; the deploy workflow waits for it.
ENV GIT_SHA=${GIT_SHA}
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["bun", "apps/api/src/index.ts"]
