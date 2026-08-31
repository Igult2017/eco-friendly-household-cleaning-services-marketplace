import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, providers, providerServices, users, disputes, customerReviews } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { CalendarDays, MapPin, Leaf, MessageSquare, MessageSquareWarning, FileText, CheckCircle2, Clock, AlertCircle, Hourglass, XCircle, CalendarClock } from "lucide-react"
import { ProposalBanner } from "@/components/booking/ProposalBanner"
import { ProposeChangeTrigger } from "@/components/booking/ProposeChangeTrigger"
import { NoShowReport } from "@/components/booking/NoShowReport"
import { CancelBookingReport } from "@/components/booking/CancelBookingReport"
import { RateClientCard } from "@/components/provider/RateClientCard"
import { ContactSupportPanel } from "@/components/messaging/ContactSupportPanel"
import { disputeReasonLabelKey } from "@/lib/constants/disputeReasons"

export const dynamic = "force-dynamic"

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: React.ElementType }> = {
  pending_payment:    { labelKey: "statusAwaitingPayment", color: "bg-amber-100 text-amber-700",     icon: Clock },
  payment_authorized: { labelKey: "statusConfirmed",       color: "bg-blue-100 text-blue-700",       icon: CalendarDays },
  confirmed:          { labelKey: "statusConfirmed",       color: "bg-blue-100 text-blue-700",       icon: CalendarDays },
  in_progress:        { labelKey: "statusInProgress",      color: "bg-[#D1F0E0] text-[#2D7A5F]",    icon: Clock },
  pending_capture:    { labelKey: "statusFinishingUp",     color: "bg-amber-100 text-amber-700",     icon: Clock },
  completed:          { labelKey: "statusCompleted",       color: "bg-green-100 text-green-700",     icon: CheckCircle2 },
  cancelled:          { labelKey: "statusCancelled",       color: "bg-gray-100 text-gray-500",       icon: XCircle },
  disputed:           { labelKey: "statusDisputed",        color: "bg-orange-100 text-orange-700",   icon: AlertCircle },
  refunded:           { labelKey: "statusRefunded",        color: "bg-purple-100 text-purple-700",   icon: CheckCircle2 },
  client_no_show:     { labelKey: "statusClientNoShow",    color: "bg-red-100 text-red-700",         icon: XCircle },
  cleaner_no_show:    { labelKey: "statusCleanerNoShow",   color: "bg-red-100 text-red-700",         icon: XCircle },
}

export default async function ProviderBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const t = await getTranslations("providerBookingsIdPage")
  const tl = await getTranslations("providerProviderBookingsPage")
  const td = await getTranslations("providerBookingsIdDisputePage")
  const { id } = await params

  const [provider] = await db.select({ id: providers.id, country: providers.country }).from(providers).where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/onboarding")

  const [booking] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      scheduledEndAt: bookings.scheduledEndAt,
      serviceAddress: bookings.serviceAddress,
      specialInstructions: bookings.specialInstructions,
      ecoOptionsSelected: bookings.ecoOptionsSelected,
      providerPayout: bookings.providerPayout,
      cancellationReason: bookings.cancellationReason,
      pendingProposal: bookings.pendingProposal,
      customerName: users.firstName,
      customerEmail: users.email,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.customerId, users.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(and(eq(bookings.id, id), eq(bookings.providerId, provider.id)))

  if (!booking) notFound()

  const [dispute] = await db
    .select({ reason: disputes.reason, description: disputes.description, status: disputes.status, resolution: disputes.resolution })
    .from(disputes)
    .where(eq(disputes.bookingId, id))

  const [existingReview] = await db.select({ id: customerReviews.id }).from(customerReviews).where(eq(customerReviews.bookingId, id))

  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed
  const StatusIcon = cfg.icon

  const canManage = ["confirmed", "in_progress"].includes(booking.status) && !booking.pendingProposal
  const canDispute = ["payment_authorized", "confirmed", "in_progress", "pending_capture", "completed"].includes(booking.status)

  const addr = booking.serviceAddress as { line1: string; line2?: string; city: string; postalCode: string; country: string }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <Link href="/provider/bookings" className="inline-flex items-center text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors">
        {t("backToBookings")}
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-[#9CA3AF] mb-1">{booking.bookingNumber}</p>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{booking.serviceName ?? tl("defaultServiceName")}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{tl("customerLabel", { name: booking.customerName ?? booking.customerEmail ?? "—" })}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cfg.color}`}>
            <StatusIcon size={13} />
            {tl(cfg.labelKey)}
          </span>
        </div>
      </div>

      {/* A pending change (either side may have proposed one) — the party who did NOT propose it
          accepts or declines; the proposer sees a waiting indicator instead. */}
      {booking.pendingProposal && ["confirmed", "in_progress"].includes(booking.status) && (
        booking.pendingProposal.proposedBy === "provider" ? (
          <p className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Hourglass size={15} className="shrink-0" /> {tl("awaitingClient")}
          </p>
        ) : (
          <ProposalBanner bookingId={booking.id} proposal={booking.pendingProposal} providerCountry={provider.country ?? "DE"} />
        )
      )}

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6 space-y-4">
        <h2 className="font-semibold text-[#2B3441]">{t("bookingDetailsTitle")}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays size={16} className="text-[#2D7A5F] mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[#2B3441]">{formatDate(booking.scheduledAt)}</p>
              {booking.scheduledEndAt && (
                <p className="text-[#9CA3AF] text-xs">{t("untilTime", { time: new Date(booking.scheduledEndAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) })}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-[#2D7A5F] mt-0.5 shrink-0" />
            <div>
              <p className="text-[#2B3441]">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
              <p className="text-[#9CA3AF] text-xs">{addr.postalCode} {addr.city}, {addr.country}</p>
            </div>
          </div>
          {booking.specialInstructions && (
            <div className="rounded-xl bg-[#F4FAF6] px-4 py-3 text-[#6B7280] leading-relaxed">
              {booking.specialInstructions}
            </div>
          )}
          {(booking.ecoOptionsSelected ?? []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Leaf size={14} className="text-[#2D7A5F]" />
              {(booking.ecoOptionsSelected ?? []).map((opt) => (
                <span key={opt} className="rounded-full bg-[#D1F0E0] text-[#2D7A5F] text-xs font-medium px-2.5 py-0.5">{opt}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payout */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-[#2B3441]">{tl("yourPayout")}</h2>
          <span className="text-lg font-bold text-[#2D7A5F]">{formatCurrency(booking.providerPayout)}</span>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-2">{t("payoutInfo")}</p>
      </div>

      {booking.status === "completed" && (
        <Link href={`/provider/bookings/${booking.id}/receipt`} className="inline-flex items-center gap-2 text-sm font-medium text-[#2D7A5F] hover:underline">
          <FileText size={15} /> {tl("receiptLink")}
        </Link>
      )}

      {(booking.status === "cancelled" || booking.status === "client_no_show" || booking.status === "cleaner_no_show") && booking.cancellationReason && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5">
          <h2 className="font-semibold text-[#2B3441] mb-2">{tl("cancellationReasonLabel")}</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed">{booking.cancellationReason}</p>
        </div>
      )}

      {dispute && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 space-y-2">
          <h2 className="font-semibold text-[#2B3441]">{td("detailTitle")}</h2>
          <p className="text-sm font-medium text-[#2B3441]">{td(disputeReasonLabelKey(dispute.reason))}</p>
          <p className="text-sm text-[#6B7280] leading-relaxed">{dispute.description}</p>
          {dispute.resolution && (
            <p className="text-sm text-[#2D7A5F] font-medium pt-2 border-t border-[#E5EBF0]">
              {td("resolutionLabel")}: {dispute.resolution}
            </p>
          )}
        </div>
      )}

      {booking.status === "completed" && <RateClientCard bookingId={booking.id} alreadyReviewed={!!existingReview} />}

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/provider/bookings/${booking.id}/complete`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
          >
            <CalendarClock size={14} /> {tl("markAsComplete")}
          </Link>
          <ProposeChangeTrigger bookingId={booking.id} allowRateChange />
          <NoShowReport bookingId={booking.id} side="cleaner" />
          <CancelBookingReport bookingId={booking.id} />
        </div>
      )}

      {/* Contact the client + support — both were previously only reachable from the chat page. */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/provider/bookings/${booking.id}/messages`}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D7A5F]/30 text-[#2D7A5F] hover:bg-[#F4FAF6] text-sm font-semibold px-4 py-3 transition-colors"
        >
          <MessageSquare size={15} /> {t("messageClient")}
        </Link>
        {canDispute && !dispute && (
          <Link
            href={`/provider/bookings/${booking.id}/dispute`}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 text-orange-600 hover:bg-orange-50 text-sm font-medium px-4 py-3 transition-colors"
          >
            <MessageSquareWarning size={15} /> {td("openDispute")}
          </Link>
        )}
      </div>
      <ContactSupportPanel side="cleaner" bookingId={booking.id} triggerClassName="inline-flex items-center gap-1.5 rounded-xl border border-[#E5EBF0] bg-white px-4 py-3 text-sm font-medium text-[#6B7280] transition-colors hover:border-[#2D7A5F] hover:text-[#2D7A5F] w-full sm:w-auto justify-center" />
    </div>
  )
}
