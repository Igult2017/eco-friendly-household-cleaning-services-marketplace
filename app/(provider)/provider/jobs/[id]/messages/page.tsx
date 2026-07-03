export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { db } from "@/lib/db"
import { jobPosts, bids, providers, users, bookings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { ChevronLeft } from "lucide-react"
import { MessageThread } from "@/components/messaging/MessageThread"
import { CompletionBar } from "@/components/booking/CompletionBar"
import { ChatActions } from "@/components/messaging/ChatActions"

// Cleaner side of the per-job chat (they won the bid). Thread title = the job's title.
export default async function ProviderJobMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const { id } = await params
  const t = await getTranslations("providerMessagesPage")

  const [job] = await db
    .select({ id: jobPosts.id, title: jobPosts.title, acceptedBidId: jobPosts.acceptedBidId, customerId: jobPosts.customerId })
    .from(jobPosts)
    .where(eq(jobPosts.id, id))
  if (!job?.acceptedBidId) notFound()

  // Only the ACCEPTED bid's cleaner may open this thread.
  const [winner] = await db
    .select({ providerUserId: providers.userId, bookingId: bids.bookingId })
    .from(bids)
    .innerJoin(providers, eq(bids.providerId, providers.id))
    .where(eq(bids.id, job.acceptedBidId))
  if (winner?.providerUserId !== userId) notFound()

  // Booking from the accepted bid (once the client finished checkout) — completion buttons live here.
  const [booking] = winner.bookingId
    ? await db
        .select({ id: bookings.id, status: bookings.status, providerCompletedAt: bookings.providerCompletedAt, clientConfirmedAt: bookings.clientConfirmedAt })
        .from(bookings)
        .where(eq(bookings.id, winner.bookingId))
    : [undefined]

  const [client] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, job.customerId))
  const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(" ")

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/provider/messages" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] transition-colors">
          <ChevronLeft size={14} /> {t("threadBack")}
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold text-[#2B3441]">{job.title}</h1>
        {clientName && <p className="text-sm text-[#6B7280] mt-0.5">{t("threadWith", { name: clientName })}</p>}
      </div>
      {booking && (
        <CompletionBar
          bookingId={booking.id}
          side="cleaner"
          status={booking.status}
          providerCompleted={!!booking.providerCompletedAt}
          clientConfirmed={!!booking.clientConfirmedAt}
        />
      )}
      <ChatActions side="cleaner" jobId={job.id} bookingId={booking?.id} bookingStatus={booking?.status} />
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-4">
        <MessageThread
          bookingId={job.id}
          currentUserId={userId}
          endpoint={`/api/jobs/${job.id}/messages`}
          channel={`private-job-${job.id}`}
          readOnly={booking ? booking.status === "completed" || booking.status === "cancelled" : false}
        />
      </div>
    </div>
  )
}
