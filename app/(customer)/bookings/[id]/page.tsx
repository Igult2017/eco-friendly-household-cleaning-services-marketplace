import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { bookings, payments, providers, providerServices, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { CalendarDays, MapPin, Leaf, Star, MessageSquareWarning, XCircle, CheckCircle2, Clock, AlertCircle, CalendarClock } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment:    { label: "Pending Payment",  color: "bg-yellow-100 text-yellow-700",  icon: Clock },
  payment_authorized: { label: "Confirmed",        color: "bg-blue-100 text-blue-700",      icon: CalendarDays },
  confirmed:          { label: "Confirmed",        color: "bg-blue-100 text-blue-700",      icon: CalendarDays },
  in_progress:        { label: "In Progress",      color: "bg-[#D1F0E0] text-[#2D7A5F]",   icon: Clock },
  completed:          { label: "Completed",        color: "bg-green-100 text-green-700",    icon: CheckCircle2 },
  cancelled:          { label: "Cancelled",        color: "bg-red-100 text-red-700",        icon: XCircle },
  disputed:           { label: "Disputed",         color: "bg-orange-100 text-orange-700",  icon: AlertCircle },
  refunded:           { label: "Refunded",         color: "bg-gray-100 text-gray-500",      icon: CheckCircle2 },
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const { id } = await params

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
      carbonOffsetAmount: bookings.carbonOffsetAmount,
      subtotalAmount: bookings.subtotalAmount,
      platformFeeAmount: bookings.platformFeeAmount,
      totalAmount: bookings.totalAmount,
      cancellationReason: bookings.cancellationReason,
      cancelledAt: bookings.cancelledAt,
      createdAt: bookings.createdAt,
      customerId: bookings.customerId,
      providerId: bookings.providerId,
      providerBusinessName: providers.businessName,
      providerSlug: providers.slug,
      providerCity: providers.city,
      serviceName: providerServices.name,
    })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))

  if (!booking) notFound()

  const [payment] = await db
    .select({ status: payments.status, capturedAmount: payments.capturedAmount, refundedAmount: payments.refundedAmount, capturedAt: payments.capturedAt })
    .from(payments)
    .where(eq(payments.bookingId, id))

  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed
  const StatusIcon = cfg.icon

  const canCancel = ["payment_authorized", "confirmed"].includes(booking.status)
  const canReschedule = ["payment_authorized", "confirmed"].includes(booking.status)
  const canDispute = booking.status === "completed"
  const canReview = booking.status === "completed"

  const addr = booking.serviceAddress as { line1: string; line2?: string; city: string; postalCode: string; country: string }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors">
        ← Back to dashboard
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-[#9CA3AF] mb-1">{booking.bookingNumber}</p>
            <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{booking.serviceName ?? "Cleaning Service"}</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              with <Link href={`/providers/${booking.providerSlug}`} className="text-[#2D7A5F] hover:underline font-medium">{booking.providerBusinessName}</Link>
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cfg.color}`}>
            <StatusIcon size={13} />
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6 space-y-4">
        <h2 className="font-semibold text-[#2B3441]">Booking Details</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays size={16} className="text-[#2D7A5F] mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[#2B3441]">{formatDate(booking.scheduledAt)}</p>
              {booking.scheduledEndAt && (
                <p className="text-[#9CA3AF] text-xs">until {new Date(booking.scheduledEndAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
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

      {/* Payment summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-6">
        <h2 className="font-semibold text-[#2B3441] mb-4">Payment</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-[#6B7280]">
            <span>Service</span>
            <span>{formatCurrency(booking.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between text-[#6B7280]">
            <span>Platform fee (15%)</span>
            <span>{formatCurrency(booking.platformFeeAmount)}</span>
          </div>
          {(booking.carbonOffsetAmount ?? 0) > 0 && (
            <div className="flex justify-between text-[#2D7A5F]">
              <span className="flex items-center gap-1"><Leaf size={12} /> Carbon offset</span>
              <span>{formatCurrency(booking.carbonOffsetAmount!)}</span>
            </div>
          )}
          <div className="border-t border-[#E5EBF0] my-2" />
          <div className="flex justify-between font-bold text-[#2B3441]">
            <span>Total</span>
            <span>{formatCurrency(booking.totalAmount)}</span>
          </div>
          {payment && (
            <p className="text-xs text-[#9CA3AF] pt-1">
              {payment.status === "captured"
                ? `Charged on ${payment.capturedAt ? new Date(payment.capturedAt).toLocaleDateString("de-DE") : "—"}`
                : payment.status === "refunded"
                ? `Refunded ${formatCurrency(payment.refundedAmount ?? 0)}`
                : "Pre-authorised — charged after completion"}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {(canCancel || canReschedule || canDispute || canReview) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {canReview && (
            <Link
              href={`/bookings/${booking.id}/review`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold px-4 py-3 transition-colors"
            >
              <Star size={15} /> Leave a Review
            </Link>
          )}
          {canDispute && (
            <Link
              href={`/bookings/${booking.id}/dispute`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 text-orange-600 hover:bg-orange-50 text-sm font-medium px-4 py-3 transition-colors"
            >
              <MessageSquareWarning size={15} /> Open Dispute
            </Link>
          )}
          {canReschedule && (
            <Link
              href={`/bookings/${booking.id}/reschedule`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#2D7A5F]/30 text-[#2D7A5F] hover:bg-[#F4FAF6] text-sm font-medium px-4 py-3 transition-colors"
            >
              <CalendarClock size={15} /> Reschedule
            </Link>
          )}
          {canCancel && (
            <Link
              href={`/bookings/${booking.id}/cancel`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium px-4 py-3 transition-colors"
            >
              <XCircle size={15} /> Cancel Booking
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
