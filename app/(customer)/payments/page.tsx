import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { payments, bookings, providerServices, providers } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { formatCurrency } from "@/lib/utils/formatCurrency"
import { Leaf } from "lucide-react"

export const dynamic = "force-dynamic"

const STATUS_STYLE: Record<string, string> = {
  authorized:           "bg-blue-100 text-blue-700",
  captured:             "bg-green-100 text-green-700",
  refunded:             "bg-purple-100 text-purple-700",
  partially_refunded:   "bg-amber-100 text-amber-700",
  failed:               "bg-red-100 text-red-700",
  pending:              "bg-gray-100 text-gray-500",
}

export default async function CustomerPaymentsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const rows = await db
    .select({
      id: payments.id,
      status: payments.status,
      amount: payments.amount,
      capturedAmount: payments.capturedAmount,
      refundedAmount: payments.refundedAmount,
      currency: payments.currency,
      capturedAt: payments.capturedAt,
      createdAt: payments.createdAt,
      bookingNumber: bookings.bookingNumber,
      scheduledAt: bookings.scheduledAt,
      carbonOffsetAmount: bookings.carbonOffsetAmount,
      serviceName: providerServices.name,
      providerName: providers.businessName,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .where(eq(payments.customerId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(50)

  const totalCaptured = rows.filter((r) => r.status === "captured").reduce((s, r) => s + (r.capturedAmount ?? 0), 0)
  const totalOffset = rows.reduce((s, r) => s + (r.carbonOffsetAmount ?? 0), 0)

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Payment History</h1>
        <p className="text-sm text-[#6B7280] mt-1">All charges and authorisations for your bookings</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white shadow-sm border border-[#E5EBF0] p-5">
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-[#2B3441]">{formatCurrency(totalCaptured)}</p>
        </div>
        <div className="rounded-2xl bg-white shadow-sm border border-[#2D7A5F]/30 p-5">
          <p className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-wide mb-1 flex items-center gap-1">
            <Leaf size={11} /> Carbon Offset
          </p>
          <p className="text-2xl font-bold text-[#2D7A5F]">{formatCurrency(totalOffset)}</p>
          <p className="text-xs text-[#9CA3AF] mt-0.5">contributed to tree planting</p>
        </div>
      </div>

      {/* Payments table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-sm py-20 text-center">
          <p className="text-[#6B7280] text-sm">No payments yet. Complete a booking to see your payment history.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm border border-[#E5EBF0] overflow-hidden">
          <div className="divide-y divide-gray-100">
            {rows.map((p) => {
              const style = STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-600"
              const date = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
                : "—"
              return (
                <div key={p.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm text-[#2B3441]">{p.bookingNumber ?? "—"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
                        {p.status.replace("_", " ")}
                      </span>
                      {(p.carbonOffsetAmount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#D1F0E0] px-2 py-0.5 text-xs font-semibold text-[#2D7A5F]">
                          <Leaf size={10} /> offset
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280]">
                      {p.serviceName ?? "Service"} · {p.providerName ?? "Provider"} · {date}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[#2B3441]">{formatCurrency(p.amount)}</p>
                    {(p.refundedAmount ?? 0) > 0 && (
                      <p className="text-xs text-purple-600">−{formatCurrency(p.refundedAmount ?? 0)} refunded</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
