import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { bookings, providers, users } from "@/lib/db/schema"
import { CompletionBar } from "@/components/booking/CompletionBar"
import { eq } from "drizzle-orm"
import { MessageThread } from "@/components/messaging/MessageThread"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { getTranslations } from "next-intl/server"

export const dynamic = "force-dynamic"

export default async function ProviderMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = await getTranslations("providerProviderBookingsIdMessagesPage")
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

  const [row] = await db
    .select({
      bookingId: bookings.id,
      customerId: bookings.customerId,
      status: bookings.status,
      providerCompletedAt: bookings.providerCompletedAt,
      clientConfirmedAt: bookings.clientConfirmedAt,
      providerUserId: providers.userId,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      customerEmail: users.email,
    })
    .from(bookings)
    .innerJoin(providers, eq(bookings.providerId, providers.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .where(eq(bookings.id, id))

  if (!row) notFound()
  if (row.providerUserId !== userId) notFound()

  const customerName =
    [row.customerFirstName, row.customerLastName].filter(Boolean).join(" ") ||
    row.customerEmail

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/provider/bookings`}
          className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors"
        >
          <ArrowLeft size={15} />
          {t("backToBookings")}
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#D1F0E0] flex items-center justify-center shrink-0">
          <MessageSquare size={17} className="text-[#2D7A5F]" />
        </div>
        <div>
          <h1 className="font-serif text-lg font-bold text-[#2B3441] leading-tight">
            {customerName}
          </h1>
          <p className="text-xs text-[#9CA3AF]">{t("customerConversation")}</p>
        </div>
      </div>

      {/* Dual-confirm completion, right in the chat — both press their button to close the order. */}
      <CompletionBar
        bookingId={id}
        side="cleaner"
        status={row.status}
        providerCompleted={!!row.providerCompletedAt}
        clientConfirmed={!!row.clientConfirmedAt}
      />

      <MessageThread bookingId={id} currentUserId={userId} readOnly={row.status === "completed" || row.status === "cancelled"} />
    </div>
  )
}
