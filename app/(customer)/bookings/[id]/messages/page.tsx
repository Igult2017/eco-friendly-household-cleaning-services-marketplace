import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { MessageThread } from "@/components/messaging/MessageThread"
import { ArrowLeft, MessageSquare } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CustomerMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const [booking] = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      providerId: bookings.providerId,
      providerBusinessName: providers.businessName,
    })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))

  if (!booking) notFound()

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/bookings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors"
        >
          <ArrowLeft size={15} />
          Back to booking
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#D1F0E0] flex items-center justify-center shrink-0">
          <MessageSquare size={17} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-lg font-bold text-[#2B3441] leading-tight">
            {booking.providerBusinessName ?? "Provider"}
          </h1>
          <p className="text-xs text-[#9CA3AF]">Booking conversation</p>
        </div>
      </div>

      <MessageThread bookingId={id} currentUserId={userId} />
    </div>
  )
}
