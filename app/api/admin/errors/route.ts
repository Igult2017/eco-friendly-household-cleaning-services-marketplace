import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"
import { desc, isNull, isNotNull, eq, and, count, gte } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

const PAGE_SIZE = 50
const VALID_SEVERITIES = ["info", "warning", "error", "critical"] as const
const VALID_FILTERS = ["unresolved", "resolved", "all"] as const

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "unresolved"
    const severityParam = searchParams.get("severity")
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const offset = (page - 1) * PAGE_SIZE

    if (!VALID_FILTERS.includes(filter as any)) {
      return NextResponse.json({ error: "Invalid filter" }, { status: 400 })
    }
    if (severityParam && !VALID_SEVERITIES.includes(severityParam as any)) {
      return NextResponse.json({ error: "Invalid severity" }, { status: 400 })
    }
    const severity = severityParam as typeof VALID_SEVERITIES[number] | null

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const conditions = []
    if (filter === "unresolved") conditions.push(isNull(errorLogs.resolvedAt))
    if (filter === "resolved") conditions.push(isNotNull(errorLogs.resolvedAt))
    if (severity) conditions.push(eq(errorLogs.severity, severity))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [{ total }], [{ last24h }], [{ critical }]] = await Promise.all([
      db.select().from(errorLogs).where(where).orderBy(desc(errorLogs.createdAt)).limit(PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(errorLogs).where(where),
      db.select({ last24h: count() }).from(errorLogs).where(
        and(isNull(errorLogs.resolvedAt), gte(errorLogs.createdAt, since24h))
      ),
      db.select({ critical: count() }).from(errorLogs).where(
        and(isNull(errorLogs.resolvedAt), eq(errorLogs.severity, "critical"))
      ),
    ])

    return NextResponse.json({ errors: rows, total, last24h, critical, page, hasMore: rows.length === PAGE_SIZE })
  } catch (err) {
    console.error("[admin/errors GET]", err)
    void logError({ message: "[admin/errors GET]", error: err, route: "/api/admin/errors", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
