"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"

interface BookingInfo {
  id: string
  bookingNumber: string
  scheduledAt: string
  totalAmount: number
  status: string
  provider: { businessName: string }
  service: { name: string }
}

interface RefundInfo { refundPercent: number; refundAmount: number }

function calcRefundPercent(scheduledAt: string): number {
  const hours = (new Date(scheduledAt).getTime() - Date.now()) / 3_600_000
  if (hours > 48) return 100
  if (hours > 24) return 50
  return 0
}

export default function CancelBookingPage() {
  const t = useTranslations("customerBookingsIdCancelPage")
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState("")
  const [done, setDone] = useState<RefundInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.booking) setBooking(d.booking) })
      .catch(() => setError(t("errorLoadBooking")))
      .finally(() => setLoading(false))
  }, [id, t])

  async function handleCancel() {
    setCancelling(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? t("errorCancellationFailed")); return }
      setDone({ refundPercent: data.refundPercent, refundAmount: data.refundAmount })
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F4FAF6] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-[#2D7A5F]" />
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-[#F4FAF6] py-20 px-4 flex flex-col items-center justify-center">
      <CheckCircle2 size={48} className="text-[#2D7A5F] mb-4" />
      <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("doneTitle")}</h1>
      {done.refundAmount > 0
        ? <p className="text-[#6B7280] text-center mb-6">{t.rich("doneRefundText", { amount: formatCurrency(done.refundAmount), percent: done.refundPercent, strong: (chunks) => <strong>{chunks}</strong> })}</p>
        : <p className="text-[#6B7280] text-center mb-6">{t("doneNoRefundText")}</p>
      }
      <Button onClick={() => router.push("/dashboard")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">{t("backToDashboard")}</Button>
    </div>
  )

  if (!booking) return (
    <div className="min-h-screen bg-[#F4FAF6] flex items-center justify-center">
      <p className="text-[#6B7280]">{t("notFound")}</p>
    </div>
  )

  const refundPct = calcRefundPercent(booking.scheduledAt)
  const refundAmt = Math.round(booking.totalAmount * refundPct / 100)

  return (
    <div className="min-h-screen bg-[#F4FAF6] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle size={24} className="text-amber-500" />
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("title")}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5EBF0] p-5 mb-4 space-y-2 text-sm">
          <p><span className="text-[#6B7280]">{t("labelBooking")}</span> <strong>{booking.bookingNumber}</strong></p>
          <p><span className="text-[#6B7280]">{t("labelService")}</span> {booking.service?.name}</p>
          <p><span className="text-[#6B7280]">{t("labelProvider")}</span> {booking.provider?.businessName}</p>
          <p><span className="text-[#6B7280]">{t("labelScheduled")}</span> {formatDate(booking.scheduledAt)}</p>
          <p><span className="text-[#6B7280]">{t("labelAmountCharged")}</span> {formatCurrency(booking.totalAmount)}</p>
        </div>

        <div className={`rounded-2xl border p-4 mb-6 text-sm ${refundPct === 100 ? "bg-[#F4FAF6] border-[#2D7A5F]/30" : refundPct === 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
          <p className="font-semibold mb-1">{t("refundPolicyTitle")}</p>
          <p>{refundPct === 100 && t("refundFull")}</p>
          <p>{refundPct === 50 && t("refundPartial")}</p>
          <p>{refundPct === 0 && t("refundNone")}</p>
          {refundAmt > 0 && <p className="mt-2 font-medium">{t("youWillReceive", { amount: formatCurrency(refundAmt) })}</p>}
        </div>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("reasonPlaceholder")}
          rows={3}
          className="w-full rounded-xl border border-[#E5EBF0] p-3 text-sm text-[#2B3441] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/30 mb-4"
        />

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()} className="flex-1 border-[#E5EBF0]">{t("keepBooking")}</Button>
          <Button onClick={handleCancel} disabled={cancelling} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
            {cancelling ? <><Loader2 size={16} className="animate-spin mr-2" />{t("cancelling")}</> : t("confirmCancellation")}
          </Button>
        </div>
      </div>
    </div>
  )
}
