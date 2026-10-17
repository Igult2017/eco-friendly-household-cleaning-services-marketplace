# syntax=docker/dockerfile:1.4
# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Install production + dev dependencies.
# --mount=type=cache keeps the npm download cache on the build host between runs,
# so re-installs are fast even when package.json changes.
# Layer cache: if package.json is unchanged, Docker skips this stage entirely.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# The lockfile is REQUIRED, not optional (it used to be copied with a `*` glob, which silently
# tolerated its absence). Without it every build re-resolved all 65 dependencies live from the
# registry, so two builds of the same commit were never guaranteed to be the same thing -- and a
# build duly broke overnight on 2026-10-17 with no code change at all.
COPY package.json package-lock.json ./

# node:20-alpine ships npm 10.8.2, whose dependency resolver crashes on this tree with
# "Cannot read properties of null (reading 'edgesOut')". It killed three deploys in a row,
# including one that ran against a completely emptied cache -- so the cache was never the problem,
# the installer was. npm 11.6.2 resolves this identical package.json successfully (measured). The
# installer is therefore pinned here instead of being whatever the base image happens to carry.
# Deliberately non-fatal: `npm ci` below installs the lockfile verbatim and never runs the resolver
# that crashes, so the lockfile is the actual fix and this upgrade is only belt and braces. If npm
# 11 ever refuses to install on this base image's Node version, the build must carry on rather than
# die on a precaution.
RUN npm install -g npm@11.6.2 || echo "could not upgrade npm — continuing with the bundled version"

# `npm ci` installs EXACTLY what the lockfile pins, so production runs the dependency set that was
# actually built and tested, rather than whatever the registry offers at deploy time. The fallback
# exists for one case only -- a lockfile that genuinely cannot be satisfied -- so a drifted lockfile
# costs a slower build instead of taking the site's deploys down.
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci --no-audit --no-fund || { \
      echo "npm ci could not use the lockfile — falling back to a fresh resolve"; \
      npm install --no-audit --no-fund; \
    }

# ── Stage 2: builder ─────────────────────────────────────────────────────────
# Compile the Next.js app. Result is a self-contained /app/.next/standalone dir.
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (non-secret, public ones only)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
ARG NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER=eu
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME=DORIX
ARG NEXT_PUBLIC_UMAMI_URL
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
# Used by next.config rewrites() at build time to proxy the Umami tracker.
ARG UMAMI_INTERNAL_URL

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN --mount=type=cache,id=next-build,target=/app/.next/cache \
    npm run build

# ── Stage 3: migrator ────────────────────────────────────────────────────────
# Tiny image that runs drizzle migrations once before the app containers start.
FROM node:20-alpine AS migrator
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY drizzle/migrations ./drizzle/migrations
COPY scripts/migrate.mjs ./scripts/migrate.mjs

CMD ["node", "scripts/migrate.mjs"]

# ── Stage 4: runner ──────────────────────────────────────────────────────────
# Minimal runtime image — only the standalone output + static assets
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Static files
COPY --from=builder /app/public ./public

# Standalone server + prerendered pages
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration files — needed by instrumentation.ts on first boot
COPY --from=builder --chown=nextjs:nodejs /app/drizzle/migrations ./drizzle/migrations

# Multi-core entrypoint — forks one worker per CPU core (see cluster-server.cjs)
COPY --from=builder --chown=nextjs:nodejs /app/cluster-server.cjs ./cluster-server.cjs

USER nextjs

EXPOSE 3000

CMD ["node", "cluster-server.cjs"]
