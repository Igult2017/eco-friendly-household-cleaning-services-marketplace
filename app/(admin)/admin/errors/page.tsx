export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"
import { desc, isNull, isNotNull, eq, and, count, gte } from "drizzle-orm"
import { AlertTriangle, Bug, Clock, ShieldAlert, ChevronLeft, ChevronRight, Activity } from "lucide-react"
import { ErrorResolveButton } from "@/components/admin/ErrorResolveButton"
import Link from "next/link"

const PAGE_SIZE = 50
const VALID_SEVERITIES = ["info", "warning", "error", "critical"] as const
type ValidSeverity = typeof VALID_SEVERITIES[number]

const SEVERITY_COLOURS: Record<string, string> = {
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
  error:    "bg-red-50 text-red-700 border-red-200",
  critical: "bg-red-100 text-red-800 border-red-400 font-bold",
}

async function getErrors(filter: string, severity: ValidSeverity | null, page: number) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const offset = (page - 1) * PAGE_SIZE
  const conditions = []
  if (filter === "unresolved") conditions.push(isNull(errorLogs.resolvedAt))
  if (filter === "resolved")   conditions.push(isNotNull(errorLogs.resolvedAt))
  if (severity)                conditions.push(eq(errorLogs.severity, severity))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ total }], [{ last24h }], [{ critical }]] = await Promise.all([
    db.select().from(errorLogs).where(where).orderBy(desc(errorLogs.createdAt)).limit(PAGE_SIZE).offset(offset),
    db.select({ total: count() }).from(errorLogs).where(isNull(errorLogs.resolvedAt)),
    db.select({ last24h: count() }).from(errorLogs).where(and(isNull(errorLogs.resolvedAt), gte(errorLogs.createdAt, since24h))),
    db.select({ critical: count() }).from(errorLogs).where(and(isNull(errorLogs.resolvedAt), eq(errorLogs.severity, "critical"))),
  ])
  return { rows, total: Number(total), last24h: Number(last24h), critical: Number(critical), hasMore: rows.length === PAGE_SIZE }
}

export default async function AdminErrorsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const filter = sp.filter ?? "unresolved"
  const severityRaw = sp.severity ?? ""
  const severity: ValidSeverity | null = VALID_SEVERITIES.includes(severityRaw as ValidSeverity) ? (severityRaw as ValidSeverity) : null
  const page = Math.max(1, parseInt(sp.page ?? "1"))

  const { rows, total, last24h, critical, hasMore } = await getErrors(filter, severity, page)

  const FILTERS = [
    { key: "unresolved", label: "Unresolved" },
    { key: "all",        label: "All" },
    { key: "resolved",   label: "Resolved" },
  ]

  function href(patch: Record<string, string | number>) {
    const base: Record<string, string> = { filter, ...(severity ? { severity } : {}), ...(page > 1 ? { page: String(page) } : {}) }
    const merged: Record<string, string> = {}
    for (const [k, v] of Object.entries({ ...base, ...patch })) {
      if (v !== "" && v !== 0 && String(v) !== "1" || k === "filter") merged[k] = String(v)
    }
    // Always reset to page 1 when filter/severity changes
    if ("filter" in patch || "severity" in patch) delete merged.page
    return "/admin/errors?" + new URLSearchParams(merged).toString()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Error Monitor</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Application errors captured in production</p>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {/* Unresolved */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50"><Bug className="h-4 w-4 text-red-500" /></span>
            <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${total > 0 ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
              {total > 0 ? "Action needed" : "All clear"}
            </span>
          </div>
          <div>
            <p className="text-[2rem] font-bold leading-none tracking-tight text-[#2B3441]">{total}</p>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">Unresolved</p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">Open error logs</p>
          </div>
        </div>

        {/* Last 24h */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50"><Clock className="h-4 w-4 text-amber-500" /></span>
            <span className="flex items-center gap-1"><Activity className="h-3 w-3 text-amber-400" /><span className="text-xs text-[#9CA3AF]">24h</span></span>
          </div>
          <div>
            <p className="text-[2rem] font-bold leading-none tracking-tight text-[#2B3441]">{last24h}</p>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">Last 24 hours</p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">New errors</p>
          </div>
        </div>

        {/* Critical */}
        <div className={`rounded-2xl border shadow-sm px-6 py-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 ${critical > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
          <div className="flex items-center justify-between">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${critical > 0 ? "bg-red-100" : "bg-gray-50"}`}>
              <ShieldAlert className={`h-4 w-4 ${critical > 0 ? "text-red-600" : "text-gray-400"}`} />
            </span>
            {critical > 0 && <span className="animate-pulse h-2 w-2 rounded-full bg-red-500" />}
          </div>
          <div>
            <p className={`text-[2rem] font-bold leading-none tracking-tight ${critical > 0 ? "text-red-600" : "text-[#2B3441]"}`}>{critical}</p>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">Critical</p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">Highest severity</p>
          </div>
        </div>

        {/* Sentry */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50"><AlertTriangle className="h-4 w-4 text-indigo-500" /></span>
            <span className="h-2 w-2 rounded-full bg-green-400" />
          </div>
          <div>
            <p className="text-[2rem] font-bold leading-none tracking-tight text-[#2B3441]">Linked</p>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">Sentry</p>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">View full traces</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ filter: f.key })}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === f.key ? "bg-[#2D7A5F] text-white" : "text-[#6B7280] hover:text-[#2B3441]"}`}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {VALID_SEVERITIES.map((s) => (
            <Link key={s} href={severity === s ? href({ severity: "" }) : href({ severity: s })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${severity === s ? SEVERITY_COLOURS[s] : "bg-white border-gray-200 text-[#6B7280] hover:border-gray-400"}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <Bug className="h-10 w-10 mx-auto text-[#4CB87A] mb-3" />
            <p className="text-sm font-medium text-[#2B3441]">No errors found</p>
            <p className="text-xs text-[#6B7280] mt-1">
              {filter === "unresolved" ? "Everything is running smoothly." : "Nothing matches this filter."}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-[#6B7280] uppercase tracking-wide">
                  <th className="text-left px-6 py-3 w-12">Sev</th>
                  <th className="text-left px-4 py-3">Message</th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">Route</th>
                  <th className="text-left px-4 py-3 hidden xl:table-cell">User</th>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((err) => (
                  <tr key={err.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] border capitalize ${SEVERITY_COLOURS[err.severity] ?? ""}`}>
                        {err.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-[#2B3441] truncate">{err.message}</p>
                      {err.stack && (
                        <p className="text-xs text-[#6B7280] font-mono truncate mt-0.5">
                          {err.stack.split("\n")[1]?.trim()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-mono text-xs text-[#6B7280]">
                        {err.method && <span className="text-[#2D7A5F] mr-1">{err.method}</span>}
                        {err.route ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs text-[#6B7280]">
                      {err.userId ? err.userId.slice(0, 12) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap">
                      {new Date(err.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {err.resolvedAt ? (
                        <span className="text-xs text-[#4CB87A]">✓ Resolved</span>
                      ) : (
                        <ErrorResolveButton id={err.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
              <p className="text-xs text-[#6B7280]">Page {page} · {rows.length} rows</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href({ page: page - 1 })}
                    className="flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#2B3441] transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Prev
                  </Link>
                )}
                {hasMore && (
                  <Link href={href({ page: page + 1 })}
                    className="flex items-center gap-1 text-xs font-medium text-[#2D7A5F] hover:text-[#245f4a] transition-colors">
                    Next <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
