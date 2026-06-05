import * as Sentry from "@sentry/nextjs"
import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"

type Severity = "info" | "warning" | "error" | "critical"

interface LogErrorOptions {
  message: string
  error?: unknown
  route?: string
  method?: string
  statusCode?: number
  userId?: string
  severity?: Severity
  context?: Record<string, unknown>
}

export async function logError(opts: LogErrorOptions): Promise<void> {
  const { message, error, route, method, statusCode, userId, severity = "error", context } = opts

  const stack = error instanceof Error ? error.stack : undefined

  let sentryEventId: string | undefined
  try {
    if (error instanceof Error) {
      sentryEventId = Sentry.captureException(error, { extra: context })
    } else {
      sentryEventId = Sentry.captureMessage(message, severity === "critical" ? "fatal" : severity as Sentry.SeverityLevel)
    }
  } catch {
    // Sentry not initialised — continue
  }

  // Fire-and-forget: never let logging crash the caller
  db.insert(errorLogs)
    .values({ message, stack, route, method, statusCode, userId, severity, context: context ?? null, sentryEventId })
    .catch(() => undefined)
}
