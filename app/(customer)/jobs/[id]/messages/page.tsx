export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { jobPosts, bids, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { ChevronLeft } from "lucide-react"
import { MessageThread } from "@/components/messaging/MessageThread"

// Client side of the per-job chat (opens once a bid is accepted). Thread title = the job's title.
export default async function CustomerJobMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const { id } = await params
  const t = await getTranslations("customerMessagesPage")

  const [job] = await db
    .select({ id: jobPosts.id, title: jobPosts.title, acceptedBidId: jobPosts.acceptedBidId })
    .from(jobPosts)
    .where(and(eq(jobPosts.id, id), eq(jobPosts.customerId, userId)))
  if (!job?.acceptedBidId) notFound()

  const [winner] = await db
    .select({ businessName: providers.businessName })
    .from(bids)
    .innerJoin(providers, eq(bids.providerId, providers.id))
    .where(eq(bids.id, job.acceptedBidId))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/messages" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors">
          <ChevronLeft size={14} /> {t("threadBack")}
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold text-[#2B3441]">{job.title}</h1>
        {winner && <p className="text-sm text-[#6B7280] mt-0.5">{t("threadWith", { name: winner.businessName })}</p>}
      </div>
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-4">
        <MessageThread
          bookingId={job.id}
          currentUserId={userId}
          endpoint={`/api/jobs/${job.id}/messages`}
          channel={`private-job-${job.id}`}
        />
      </div>
    </div>
  )
}
