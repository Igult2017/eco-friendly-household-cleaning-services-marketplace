# ── Stage 1: deps ────────────────────────────────────────────────────────────
# Install production + dev dependencies (cached as long as package.json unchanged)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install -g npm@11 && npm ci

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

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build

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

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
