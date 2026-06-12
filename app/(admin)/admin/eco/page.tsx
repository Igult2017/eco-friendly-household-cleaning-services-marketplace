export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { ecoCertifications, providers, carbonOffsetContributions } from "@/lib/db/schema"
import { eq, desc, sum, count } from "drizzle-orm"
import { Leaf, Award, TrendingUp, CheckCircle2, Clock, AlertTriangle, Zap, BarChart3 } from "lucide-react"

const LEVEL_CONFIG: Record<string, { label: string; bar: string; pill: string; text: string }> = {
  basic:       { label: "Basic",       bar: "bg-slate-300",   pill: "bg-slate-100 text-slate-600",   text: "text-slate-600" },
  certified:   { label: "Certified",   bar: "bg-[#4CB87A]",   pill: "bg-[#E8F8EE] text-[#2D7A5F]",  text: "text-[#2D7A5F]" },
  premium:     { label: "Premium",     bar: "bg-[#2D7A5F]",   pill: "bg-[#D1F0E0] text-[#1a5c45]",  text: "text-[#1a5c45]" },
  zero_impact: { label: "Zero Impact", bar: "bg-[#2B3441]",   pill: "bg-[#E3E8EE] text-[#2B3441]",  text: "text-[#2B3441]" },
}

function levelCfg(level: string | null) {
  return LEVEL_CONFIG[level ?? ""] ?? LEVEL_CONFIG.basic
}

function formatDate(d: Date | string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
}

function isExpired(d: Date | string | null) {
  if (!d) return false
  return new Date(d) < new Date()
}

export default async function AdminEcoPage() {
  const [certs, , [ecoStats]] = await Promise.all([
    db.select({
      id: ecoCertifications.id,
      name: ecoCertifications.name,
      issuingBody: ecoCertifications.issuingBody,
      verifiedAt: ecoCertifications.verifiedAt,
      expiresAt: ecoCertifications.expiresAt,
      createdAt: ecoCertifications.createdAt,
      businessName: providers.businessName,
      ecoLevel: providers.ecoLevel,
    }).from(ecoCertifications)
      .leftJoin(providers, eq(ecoCertifications.providerId, providers.id))
      .orderBy(desc(ecoCertifications.createdAt))
      .limit(50),

    db.select({
      id: carbonOffsetContributions.id,
      amount: carbonOffsetContributions.amount,
      offsetProvider: carbonOffsetContributions.offsetProvider,
      createdAt: carbonOffsetContributions.createdAt,
      businessName: providers.businessName,
    }).from(carbonOffsetContributions)
      .leftJoin(providers, eq(carbonOffsetContributions.providerId, providers.id))
      .orderBy(desc(carbonOffsetContributions.createdAt))
      .limit(20),

    db.select({ total: sum(carbonOffsetContributions.amount), count: count() }).from(carbonOffsetContributions),
  ])

  const ecoLevelCounts = await db
    .select({ ecoLevel: providers.ecoLevel, count: count() })
    .from(providers)
    .where(eq(providers.isApproved, true))
    .groupBy(providers.ecoLevel)

  const totalProviders = ecoLevelCounts.reduce((s, l) => s + Number(l.count), 0)
  const verifiedCount = certs.filter((c) => c.verifiedAt).length
  const pendingCount = certs.length - verifiedCount
  const expiredCount = certs.filter((c) => isExpired(c.expiresAt)).length
  const offsetTotal = Number(ecoStats?.total ?? 0) / 100
  const offsetCount = Number(ecoStats?.count ?? 0)

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#D1F0E0] flex items-center justify-center flex-shrink-0">
          <Leaf size={18} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441] leading-tight">Eco Dashboard</h1>
          <p className="text-sm text-[#6B7280]">Carbon offsets, eco certifications, and sustainability metrics</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

        {/* Carbon offsets */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-[#F0FBF5] opacity-60" />
          <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full bg-[#D1F0E0] opacity-40" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-[#D1F0E0] flex items-center justify-center mb-4">
              <TrendingUp size={16} className="text-[#2D7A5F]" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Carbon Offsets</p>
            <p className="text-3xl font-bold text-[#2B3441] mt-1 tracking-tight">
              €{offsetTotal.toFixed(2)}
            </p>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D7A5F] bg-[#EBF7F2] rounded-full px-2.5 py-0.5">
                {offsetCount} contribution{offsetCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Certifications */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-amber-50 opacity-60" />
          <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full bg-amber-100 opacity-40" />
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
              <Award size={16} className="text-amber-600" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">Certifications</p>
            <p className="text-3xl font-bold text-[#2B3441] mt-1 tracking-tight">{certs.length}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-0.5">
                <CheckCircle2 size={10} /> {verifiedCount} verified
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-0.5">
                  <Clock size={10} /> {pendingCount} pending
                </span>
              )}
              {expiredCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 rounded-full px-2.5 py-0.5">
                  <AlertTriangle size={10} /> {expiredCount} expired
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Eco level distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="w-9 h-9 rounded-xl bg-[#E8ECF0] flex items-center justify-center mb-4">
            <BarChart3 size={16} className="text-[#2B3441]" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-4">Provider Eco Levels</p>
          {ecoLevelCounts.length > 0 ? (
            <div className="space-y-3">
              {ecoLevelCounts.map((l) => {
                const cfg = levelCfg(l.ecoLevel)
                const pct = totalProviders ? Math.round((Number(l.count) / totalProviders) * 100) : 0
                return (
                  <div key={l.ecoLevel ?? "unknown"}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[#2B3441]">{cfg.label}</span>
                      <span className="text-xs text-[#6B7280] tabular-nums">{l.count} · {pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">No approved providers yet</p>
          )}
        </div>
      </div>

      {/* Certifications table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Table header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[#2B3441]">Eco Certifications</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">All provider certifications — most recent first</p>
          </div>
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-3 py-1">
                <AlertTriangle size={11} /> {expiredCount} expired
              </span>
            )}
            <span className="text-xs font-semibold text-[#6B7280] bg-gray-100 rounded-full px-3 py-1">
              {certs.length} total
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-gray-100">
                {["Provider", "Eco Level", "Certificate", "Issuing Body", "Status", "Expires"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-50 hover:bg-[#F9FAFB] transition-colors ${
                    isExpired(c.expiresAt) ? "bg-red-50/20" : ""
                  }`}
                >
                  {/* Provider */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D1F0E0] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#2D7A5F]">
                          {(c.businessName ?? "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[#2B3441]">{c.businessName ?? "—"}</span>
                    </div>
                  </td>

                  {/* Eco Level */}
                  <td className="px-5 py-4">
                    {c.ecoLevel ? (
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${levelCfg(c.ecoLevel).pill}`}>
                        {levelCfg(c.ecoLevel).label}
                      </span>
                    ) : "—"}
                  </td>

                  {/* Certificate name */}
                  <td className="px-5 py-4">
                    <span className="text-sm font-medium text-[#2B3441]">{c.name}</span>
                  </td>

                  {/* Issuing body */}
                  <td className="px-5 py-4 text-sm text-[#6B7280]">{c.issuingBody ?? "—"}</td>

                  {/* Verified status */}
                  <td className="px-5 py-4">
                    {c.verifiedAt ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1">
                        <CheckCircle2 size={11} />
                        {formatDate(c.verifiedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">
                        <Clock size={11} />
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Expires */}
                  <td className="px-5 py-4">
                    {c.expiresAt ? (
                      isExpired(c.expiresAt) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-1">
                          <AlertTriangle size={11} />
                          {formatDate(c.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-[#6B7280]">{formatDate(c.expiresAt)}</span>
                      )
                    ) : (
                      <span className="text-sm text-[#6B7280]">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {certs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#F4FAF6] flex items-center justify-center">
                        <Leaf size={22} className="text-[#4CB87A]" />
                      </div>
                      <p className="text-sm font-semibold text-[#2B3441]">No certifications yet</p>
                      <p className="text-xs text-[#6B7280] max-w-xs">
                        Provider eco certifications will appear here once uploaded and submitted for review.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
