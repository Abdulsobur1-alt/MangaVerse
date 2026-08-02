# ─── MangaVerse API — production image ─────────────────────────────
# Multi-stage build for the Express API + BullMQ workers.
# Build context is the repo root (see docker-compose.yml / DEPLOYMENT.md).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Workspace manifests first — maximizes Docker layer caching
# .npmrc sets ignore-scripts=true (repo convention — pnpm 11 fails on
# unapproved build scripts otherwise; the build step runs prisma generate
# explicitly).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/config-typescript ./packages/config-typescript
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# ─── Dependencies ───────────────────────────────────────────────────
FROM base AS deps
# pnpm store cached in the BuildKit cache — retries after network hiccups
# reuse downloaded tarballs instead of re-fetching the whole registry.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ─── Build ─────────────────────────────────────────────────────────
FROM deps AS build
ENV NODE_ENV=production
# Compiles TS → dist/ and regenerates the Prisma client.
# ignore-scripts=true skips @prisma/engines' postinstall, so prisma
# generate downloads the engine binaries on demand — cached here so
# retries after network hiccups reuse them instead of re-fetching.
RUN --mount=type=cache,target=/root/.cache/prisma pnpm --filter @mangaverse/api build

# ─── Runner ────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# HOME=/tmp gives the non-root user a writable cache dir for npx/prisma
# (telemetry/temp writes) during `prisma migrate deploy`.
ENV HOME=/tmp
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
# The root node_modules holds the .pnpm virtual store (and the generated
# @prisma/client inside it) — copied wholesale so engines match the build.
# The per-package apps/api/node_modules is ALSO required: pnpm does NOT
# hoist bare package names (express, ioredis, …) to the workspace root,
# so node resolves the app's deps from here. COPY preserves the relative
# symlinks into ../../../node_modules/.pnpm (three levels up from
# apps/api/node_modules to the workspace root on Linux).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER nodejs
EXPOSE 3001

# Apply pending schema migrations, then start the server + workers.
# `prisma migrate deploy` is a no-op when the DB is already current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
