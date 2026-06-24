import * as Sentry from "@sentry/nextjs"

// Error capture only. Session Replay + performance tracing were removed: Replay ships a large
// extra client bundle and runs continuously, which is the heaviest part of Sentry on the client.
// Server-side error monitoring is unaffected.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  debug: false,
})
