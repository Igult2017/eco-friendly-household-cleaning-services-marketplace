export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { jobPosts, bids } from "@/lib/db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { EditJobForm } from "@/components/bidding/EditJobForm"

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const { id } = await params
  const t = await getTranslations("customerJobEditPage")

  const [job] = await db
    .select({
      id: jobPosts.id, status: jobPosts.status, title: jobPosts.title, description: jobPosts.description,
      budgetMax: jobPosts.budgetMax, estimatedDurationMinutes: jobPosts.estimatedDurationMinutes,
      desiredDate: jobPosts.desiredDate, desiredTimeRange: jobPosts.desiredTimeRange,
      recurringFrequency: jobPosts.recurringFrequency,
    })
    .from(jobPosts)
    .where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, userId)))
  if (!job || !["open", "bidding"].includes(job.status)) notFound()

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(bids).where(and(eq(bids.jobPostId, id), inArray(bids.status, ["pending", "accepted"])))
  const hasBids = Number(n) > 0

  const hours = job.estimatedDurationMinutes ? job.estimatedDurationMinutes / 60 : 2
  const rate = job.budgetMax ? (job.budgetMax / 100 / hours).toFixed(2).replace(/\.00$/, "") : ""

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-1">{t("title")}</h1>
        <p className="text-[#6B7280] mb-6">{t("subtitle")}</p>
        <EditJobForm
          jobId={job.id}
          hasBids={hasBids}
          initial={{
            title: job.title,
            description: job.description,
            hourlyRate: rate,
            estimatedHours: String(hours),
            desiredDate: job.desiredDate ?? "",
            timeStart: job.desiredTimeRange?.start ?? "",
            timeEnd: job.desiredTimeRange?.end ?? "",
            recurringFrequency: job.recurringFrequency ?? "",
          }}
        />
      </div>
    </div>
  )
}
