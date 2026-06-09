export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { reviews, users, providers } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

export default async function AdminReviewsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!me || me.role !== "admin") redirect("/")

  const flaggedReviews = await db
    .select({
      id: reviews.id,
      overallRating: reviews.overallRating,
      title: reviews.title,
      body: reviews.body,
      isFlagged: reviews.isFlagged,
      adminNote: reviews.adminNote,
      isPublic: reviews.isPublic,
      createdAt: reviews.createdAt,
      providerBusinessName: providers.businessName,
      customerEmail: users.email,
    })
    .from(reviews)
    .leftJoin(providers, eq(reviews.providerId, providers.id))
    .leftJoin(users, eq(reviews.customerId, users.id))
    .orderBy(desc(reviews.createdAt))
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Reviews Moderation</h1>
        <p className="text-sm text-[#6B7280] mt-1">{flaggedReviews.length} recent reviews</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {["Customer", "Provider", "Rating", "Content", "Status", "Date"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {flaggedReviews.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-50/50 ${r.isFlagged ? "bg-red-50/30" : ""}`}>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{r.customerEmail ?? "—"}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#2B3441]">{r.providerBusinessName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold text-sm ${r.overallRating && r.overallRating >= 4 ? "text-[#2D7A5F]" : r.overallRating && r.overallRating <= 2 ? "text-red-500" : "text-[#2B3441]"}`}>
                    ★ {r.overallRating}/5
                  </span>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {r.title && <p className="text-sm font-medium text-[#2B3441] truncate">{r.title}</p>}
                  {r.body && <p className="text-xs text-[#6B7280] truncate">{r.body}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {r.isFlagged && <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Flagged</span>}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${r.isPublic ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.isPublic ? "Public" : "Hidden"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(r.createdAt).toLocaleDateString("de-DE")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
