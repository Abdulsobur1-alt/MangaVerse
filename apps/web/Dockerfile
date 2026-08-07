# ─── MangaVerse Web — production image ─────────────────────────────
# Multi-stage build using Next.js standalone output (output: 'standalone').
# Build context is the repo root (see docker-compose.yml / DEPLOYMENT.md).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Workspace manifests first — maximizes Docker layer caching.
# Build scripts (sharp, esbuild) are approved via the allowBuilds map in
# pnpm-workspace.yaml (pnpm 11 hard-fails fresh installs otherwise).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY packages/config-typescript ./packages/config-typescript
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# ─── Dependencies ───────────────────────────────────────────────────
FROM base AS deps
# Scope the install to ONLY this image's packages. `pnpm install --filter`
# does NOT restrict downloads (verified against pnpm docs + a live test:
# it still installs every importer in the lockfile) — but trimming the
# workspace manifest does: with the lockfile frozen, pnpm installs exactly
# the workspace projects that are present. Without this, every image drags
# in apps/api (prisma), apps/mobile (react-native!) and all of next's
# optional platform binaries (@next/swc-win32-x64-msvc etc.) — ~1190
# packages measured, vs 166 with the trim — tripling install time and
# memory (an OOM/timeout risk on Render's free tier, 512 MB). allowBuilds
# is copied verbatim: entries for packages that never get installed are
# simply ignored.
RUN printf '%s\n' \
    "packages:" \
    "  - 'apps/web'" \
    "  - 'packages/shared'" \
    "  - 'packages/config-typescript'" \
    "allowBuilds:" \
    "  sharp: true" \
    "  esbuild: true" \
    "  prisma: true" \
    "  '@prisma/client': true" \
    "  '@prisma/engines': true" \
    "  '@firebase/util': true" \
    "  msgpackr-extract: true" \
    "  protobufjs: true" \
    "  '@sentry/cli': true" \
    > pnpm-workspace.yaml
# pnpm store cached in the BuildKit cache — retries after network hiccups
# reuse downloaded tarballs instead of re-fetching the whole registry.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ─── Build ─────────────────────────────────────────────────────────
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined at build time — pass them via
# build args (docker-compose wires these from the root .env).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm --filter @mangaverse/web build

# Fail fast if the standalone layout ever changes (e.g. a Next major
# upgrade): the runner and CMD below assume the entrypoint lands at
# apps/web/server.js with static + public siblings. Better to fail the
# build with a clear message than to ship a container that crashes at
# boot with an obscure "Cannot find module" error or 404s every asset.
RUN test -f /app/apps/web/.next/standalone/apps/web/server.js \
  && test -d /app/apps/web/.next/static \
  && test -d /app/apps/web/public \
  || { echo 'ERROR: standalone layout mismatch - expected .next/standalone/apps/web/server.js + .next/static + public (check outputFileTracingRoot in apps/web/next.config.ts)'; exit 1; }

# ─── Runner ────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
WORKDIR /app

# The standalone output carries its own traced node_modules + server.js.
# In a pnpm monorepo, Next nests the app under apps/web/ inside the
# standalone root (Next auto-detects pnpm-workspace.yaml as the tracing
# root — pinned via outputFileTracingRoot in next.config.ts), so the
# runtime paths are apps/web/server.js etc.
# --chown keeps .next/cache writable for the non-root user (image
# optimization cache writes there at runtime).
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nodejs:nodejs /app/apps/web/public ./apps/web/public

USER nodejs
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
