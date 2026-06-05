import { db } from "@/lib/db"
import { errorLogs } from "@/lib/db/schema"
import { desc, isNull, isNotNull, eq, and, count, gte } from "drizzle-orm"
import { AlertTriangle, Bug, Clock, ShieldAlert } from "lucide-react"
import { KpiCard } from "@/components/admin/KpiCard"
import { StatusBadge } from "@/components/admin/StatusBadge"
import { ErrorResolveButton } from "@/components/admin/ErrorResolveButton"
import Link from "next/link"

const SEVERITY_COLOURS: Record<string, string> = {
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
  error:    "bg-red-50 text-red-700 border-red-200",
  critical: "bg-red-100 text-red-800 border-red-400 font-bold",
}

async function getErrors(filter: string, severity: string | null) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const conditions = []
  if (filter === "unresolved") conditions.push(isNull(errorLogs.resolvedAt))
  if (filter === "resolved")   conditions.push(isNotNull(errorLogs.resolvedAt))
  if (severity)                conditions.push(eq(errorLogs.severity, severity as any))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, [{ total }], [{ last24h }], [{ critical }]] = await Promise.all([
    db.select().from(errorLogs).where(where).orderBy(desc(errorLogs.createdAt)).limit(100),
    db.select({ total: count() }).from(errorLogs).where(isNull(errorLogs.resolvedAt)),
    db.select({ last24h: count() }).from(errorLogs).where(and(isNull(errorLogs.resolvedAt), gte(errorLogs.createdAt, since24h))),
    db.select({ critical: count() }).from(errorLogs).where(and(isNull(errorLogs.resolvedAt), eq(errorLogs.severity, "critical"))),
  ])
  return { rows, total: Number(total), last24h: Number(last24h), critical: Number(critical) }
}

export default async function AdminErrorsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams
  const filter   = sp.filter   ?? "unresolved"
  const severity = sp.severity ?? null

  const { rows, total, last24h, critical } = await getErrors(filter, severity)

  const FILTERS = [
    { key: "unresolved", label: "Unresolved" },
    { key: "all",        label: "All" },
    { key: "resolved",   label: "Resolved" },
  ]
  const SEVERITIES = ["info", "warning", "error", "critical"]

  function href(patch: Record<string, string>) {
    const p = { filter, ...(severity ? { severity } : {}), ...patch }
    return "/admin/errors?" + new URLSearchParams(p).toString()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Error Monitor</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Application errors captured in production</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Unresolved"   value={total}   sub="Needs attention"  icon={Bug}         accent="red"   />
        <KpiCard label="Last 24 h"    value={last24h} sub="New errors"       icon={Clock}       accent="amber" />
        <KpiCard label="Critical"     value={critical} sub="Highest severity" icon={ShieldAlert} accent="red"   />
        <KpiCard label="Sentry"       value="Linked"  sub="View full traces" icon={AlertTriangle} accent="blue" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={href({ filter: f.key })}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.key ? "bg-[#2D7A5F] text-white" : "text-[#6B7280] hover:text-[#2B3441]"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {SEVERITIES.map((s) => (
            <Link
              key={s}
              href={severity === s ? href({ severity: "" }) : href({ severity: s })}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                severity === s ? SEVERITY_COLOURS[s] : "bg-white border-gray-200 text-[#6B7280] hover:border-gray-400"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
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
                <tr key={err.id} className="hover:bg-gray-50/50 transition-colors group">
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
                      <ErrorResolveButton id={err.id} onResolved={() => {}} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
