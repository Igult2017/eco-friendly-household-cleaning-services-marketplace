export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { paymentEvents, users, bookings } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { StatusBadge } from "@/components/admin/StatusBadge"

const KIND_LABELS: Record<string, string> = {
  authorized: "Authorized",
  captured: "Captured",
  refunded: "Refunded",
  transferred: "Transferred",
  payout_succeeded: "Payout succeeded",
  payout_failed: "Payout failed",
}

export default async function AdminPaymentHistoryPage() {
  const rows = await db
    .select({
      id: paymentEvents.id,
      bookingId: paymentEvents.bookingId,
      bookingNumber: bookings.bookingNumber,
      userEmail: users.email,
      kind: paymentEvents.kind,
      amountCents: paymentEvents.amountCents,
      stripeObjectId: paymentEvents.stripeObjectId,
      status: paymentEvents.status,
      metadata: paymentEvents.metadata,
      createdAt: paymentEvents.createdAt,
    })
    .from(paymentEvents)
    .leftJoin(bookings, eq(paymentEvents.bookingId, bookings.id))
    .leftJoin(users, eq(paymentEvents.userId, users.id))
    .orderBy(desc(paymentEvents.createdAt))
    .limit(200)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Payment History</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Every real money movement — authorized, captured, refunded, transferred, or a failed payout — in one place, newest first.
        </p>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {["When", "Booking", "User", "Event", "Amount", "Status", "Stripe object", "Detail"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-xs text-[#6B7280] whitespace-nowrap">{new Date(r.createdAt).toLocaleString("de-DE")}</td>
                  <td className="px-3 py-3 text-xs text-[#2B3441]">{r.bookingNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-[#6B7280]">{r.userEmail ?? "—"}</td>
                  <td className="px-3 py-3 text-sm font-medium text-[#2B3441]">{KIND_LABELS[r.kind] ?? r.kind}</td>
                  <td className="px-3 py-3 text-sm font-medium text-[#2B3441]">€{(r.amountCents / 100).toFixed(2)}</td>
                  <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-3 text-xs font-mono text-[#6B7280] truncate max-w-32">{r.stripeObjectId ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-[#6B7280] max-w-64 truncate">
                    {r.metadata ? Object.entries(r.metadata).map(([k, v]) => `${k}: ${v}`).join(" · ") : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-[#6B7280]">No payment events recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
