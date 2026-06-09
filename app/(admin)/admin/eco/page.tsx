export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ecoCertifications, providers, users, carbonOffsetContributions } from "@/lib/db/schema"
import { eq, desc, sum, count } from "drizzle-orm"

export default async function AdminEcoPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!me || me.role !== "admin") redirect("/")

  const [certs, offsets, [ecoStats]] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Eco Dashboard</h1>
        <p className="text-sm text-[#6B7280] mt-1">Carbon offsets, eco certifications, and sustainability metrics</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border-l-4 border-[#2D7A5F] bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#6B7280]">Total Offsets</p>
          <p className="text-3xl font-bold text-[#2B3441] mt-1">€{(Number(ecoStats?.total ?? 0) / 100).toFixed(2)}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">{Number(ecoStats?.count ?? 0)} contributions</p>
        </div>
        <div className="rounded-xl border-l-4 border-green-400 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#6B7280]">Certifications</p>
          <p className="text-3xl font-bold text-[#2B3441] mt-1">{certs.length}</p>
          <p className="text-xs text-[#6B7280] mt-0.5">{certs.filter((c) => c.verifiedAt).length} verified</p>
        </div>
        <div className="rounded-xl border-l-4 border-emerald-500 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-semibold text-[#6B7280]">Eco Levels</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {ecoLevelCounts.map((l) => (
              <span key={l.ecoLevel} className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-0.5 font-semibold capitalize">
                {l.ecoLevel?.replace("_", " ")}: {l.count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Certifications table */}
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2B3441]">Eco Certifications</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Provider", "Eco Level", "Certificate", "Issuing Body", "Verified", "Expires"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {certs.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">{c.businessName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize bg-green-100 text-green-700">
                    {c.ecoLevel?.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#2B3441]">{c.name}</td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{c.issuingBody ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {c.verifiedAt ? <span className="text-green-600 font-medium">✓ {new Date(c.verifiedAt).toLocaleDateString("de-DE")}</span> : "Pending"}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{c.expiresAt ?? "—"}</td>
              </tr>
            ))}
            {certs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#6B7280]">No certifications uploaded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
