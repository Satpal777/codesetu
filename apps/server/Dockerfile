# syntax=docker/dockerfile:1
#
# Server image for the pnpm + turbo monorepo.
#
# The @repo/* workspace packages are "just-in-time" packages: they export raw
# TypeScript (exports -> ./src/index.ts) and have NO build step / dist output.
# So the server cannot run as plain compiled JS (`node dist/index.js`) — at
# runtime `import "@repo/ai"` would resolve to a .ts file Node can't execute.
# We therefore run the server with tsx (same as `pnpm dev`), which transpiles
# the server + workspace TS on the fly.
#
# Build context MUST be the repo root (Coolify: Base Directory = /,
# Dockerfile Location = /apps/server/Dockerfile).

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# 1) Dependencies — copy every workspace manifest first so the layer is cached
#    and so --frozen-lockfile sees the same importer set as pnpm-lock.yaml.
# ---------------------------------------------------------------------------
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY scripts ./scripts
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/inngest/package.json ./packages/inngest/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/

# Install only the server and its workspace deps (incl. dev deps: tsx, drizzle-kit).
# NODE_ENV is left unset here so pnpm keeps devDependencies.
RUN pnpm install --frozen-lockfile --filter server...

# ---------------------------------------------------------------------------
# 2) Source — only what the server needs at runtime. .dockerignore keeps host
#    node_modules / dist out so the pnpm symlink tree from step 1 is preserved.
# ---------------------------------------------------------------------------
COPY apps/server ./apps/server
COPY packages/ai ./packages/ai
COPY packages/database ./packages/database
COPY packages/inngest ./packages/inngest
COPY packages/schemas ./packages/schemas
COPY packages/typescript-config ./packages/typescript-config

ENV NODE_ENV=production
EXPOSE 5001
WORKDIR /app/apps/server

# node is PID 1 (clean SIGTERM handling); tsx provides on-the-fly TS support.
CMD ["node", "--import", "tsx", "src/index.ts"]
