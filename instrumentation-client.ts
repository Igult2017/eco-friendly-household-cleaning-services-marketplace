import * as Sentry from "@sentry/nextjs"

// Client-side Sentry init. Canonical file for @sentry/nextjs v9+ (works under both Webpack and
// Turbopack, unlike the legacy sentry.client.config.ts which Turbopack ignores).
// Error capture only — Session Replay + tracing are off to keep the client bundle small.
// No-op until NEXT_PUBLIC_SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  debug: false,
})
