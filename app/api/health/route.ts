import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

// Uptime endpoint for an OUTSIDE monitor. Deliberately not cached and deliberately public (a
// monitoring service cannot sign in — see the entry added to isPublicRoute in middleware.ts).
//
// It checks the DATABASE too, not just "did Next.js answer". Those are different failures: a server
// that responds while its database is unreachable looks perfectly healthy to a plain homepage ping,
// yet every booking, login and payment on the site is broken.
//
// NOTE a hard limit: nothing inside this app can tell you the app is DOWN — if the container is
// dead, this route is dead with it. That alert has to come from outside the app (Coolify's own
// container notifications, or an external monitor polling this URL).
export const dynamic = "force-dynamic"

export async function GET() {
  const started = Date.now()
  let dbOk = false
  let dbError: string | undefined

  try {
    await db.execute(sql`select 1`)
    dbOk = true
  } catch (e) {
    dbError = e instanceof Error ? e.message : "unknown database error"
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    database: dbOk ? "ok" : "unreachable",
    ...(dbError ? { error: dbError } : {}),
    checkedInMs: Date.now() - started,
    time: new Date().toISOString(),
  }

  // 503 when the database is gone, so a monitor treats it as an outage rather than a healthy page.
  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
