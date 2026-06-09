import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  // maskAllText + blockAllMedia are required for GDPR compliance (EU marketplace)
  integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
})
