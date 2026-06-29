FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/inngest/package.json ./packages/inngest/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS builder
COPY . .
RUN pnpm --filter @repo/schemas build 2>/dev/null || true
RUN pnpm --filter @repo/ai build 2>/dev/null || true
RUN pnpm --filter @repo/database build 2>/dev/null || true
RUN pnpm --filter @repo/inngest build 2>/dev/null || true
RUN pnpm --filter server build

# Production image
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/inngest/package.json ./packages/inngest/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/server/dist ./apps/server/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/inngest/dist ./packages/inngest/dist
COPY --from=builder /app/packages/schemas/dist ./packages/schemas/dist

# Copy database migrations so drizzle-kit can run them at startup
COPY packages/database/drizzle ./packages/database/drizzle
COPY packages/database/drizzle.config.ts ./packages/database/drizzle.config.ts

ENV NODE_ENV=production
EXPOSE 5001

CMD ["node", "apps/server/dist/index.js"]
