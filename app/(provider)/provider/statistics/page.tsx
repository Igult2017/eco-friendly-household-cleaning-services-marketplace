export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { providers, bookings, bids } from "@/lib/db/schema"
import { eq, and, count, sum } from "drizzle-orm"
import { computeReliability, TIER_CLASS } from "@/lib/provider/reliability"
import { ShieldCheck, CheckCircle2, Star, Repeat, TrendingUp, XCircle, Gavel, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

export default async function ProviderStatisticsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("providerStatisticsPage")

  const [provider] = await db
    .select({ id: providers.id, averageRating: providers.averageRating, totalReviews: providers.totalReviews })
    .from(providers)
    .where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")
  const pid = provider.id

  const [completedRow, cancelledRow, totalBidsRow, acceptedBidsRow, byCustomer, earnedRow] = await Promise.all([
    db.select({ c: count() }).from(bookings).where(and(eq(bookings.providerId, pid), eq(bookings.status, "completed"))),
    db.select({ c: count() }).from(bookings).where(and(eq(bookings.providerId, pid), eq(bookings.status, "cancelled"), eq(bookings.cancelledBy, userId))),
    db.select({ c: count() }).from(bids).where(eq(bids.providerId, pid)),
    db.select({ c: count() }).from(bids).where(and(eq(bids.providerId, pid), eq(bids.status, "accepted"))),
    db.select({ customerId: bookings.customerId, c: count() }).from(bookings).where(and(eq(bookings.providerId, pid), eq(bookings.status, "completed"))).groupBy(bookings.customerId),
    db.select({ total: sum(bookings.providerPayout) }).from(bookings).where(and(eq(bookings.providerId, pid), eq(bookings.status, "completed"))),
  ])

  const completed = Number(completedRow[0]?.c ?? 0)
  const cancelledByProvider = Number(cancelledRow[0]?.c ?? 0)
  const totalBids = Number(totalBidsRow[0]?.c ?? 0)
  const acceptedBids = Number(acceptedBidsRow[0]?.c ?? 0)
  const repeatClients = byCustomer.filter((g) => Number(g.c) > 1).length
  const totalEarned = Number(earnedRow[0]?.total ?? 0)
  const avgRating = provider.averageRating ? Number(provider.averageRating) : null

  const reliability = computeReliability({ completed, cancelledByProvider, averageRating: avgRating, totalReviews: provider.totalReviews })
  const completionRate = completed + cancelledByProvider > 0 ? Math.round((completed / (completed + cancelledByProvider)) * 100) : 100
  const winRate = totalBids > 0 ? Math.round((acceptedBids / totalBids) * 100) : 0

  const stats = [
    { icon: CheckCircle2, label: t("jobsCompleted"), value: String(completed) },
    { icon: Star, label: t("avgRating"), value: avgRating ? `${avgRating.toFixed(1)} ⭐` : "—" },
    { icon: TrendingUp, label: t("completionRate"), value: `${completionRate}%` },
    { icon: XCircle, label: t("ownCancellations"), value: String(cancelledByProvider) },
    { icon: Gavel, label: t("bidWinRate"), value: totalBids > 0 ? `${winRate}%` : "—" },
    { icon: Repeat, label: t("repeatClients"), value: String(repeatClients) },
    { icon: MessageSquare, label: t("totalReviews"), value: String(provider.totalReviews) },
    { icon: TrendingUp, label: t("totalEarned"), value: `€${(totalEarned / 100).toFixed(0)}` },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("heading")}</h1>
        <p className="text-sm text-[#6B7280] mt-1">{t("subheading")}</p>
      </div>

      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#F4FAF6]">
          <ShieldCheck size={30} className="text-[#2D7A5F]" />
        </div>
        <div className="text-center sm:text-left">
          <p className="text-sm text-[#6B7280]">{t("yourStatus")}</p>
          <div className="mt-1 flex items-center justify-center sm:justify-start gap-3">
            <span className={cn("rounded-full px-4 py-1.5 text-base font-bold", TIER_CLASS[reliability.tier])}>{t(`tier_${reliability.tier}`)}</span>
            {reliability.tier !== "new" && (
              <span className="text-2xl font-bold text-[#2B3441]">{reliability.score}<span className="text-base text-[#9CA3AF]">/100</span></span>
            )}
          </div>
          <p className="mt-2 text-xs text-[#9CA3AF] max-w-md">{t("reliabilityExplainer")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EBF0]">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={15} className="text-[#2D7A5F]" />
              <span className="text-xs text-[#6B7280] font-medium">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-[#2B3441]">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
