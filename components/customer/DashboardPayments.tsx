import Link from "next/link"
import { CreditCard } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { formatCurrency } from "@/lib/utils/formatCurrency"

const STATUS_COLOR: Record<string, string> = {
  authorized:         "bg-blue-100 text-blue-700",
  captured:           "bg-green-100 text-green-700",
  pending_capture:    "bg-yellow-100 text-yellow-700",
  pending:            "bg-gray-100 text-gray-500",
  refunded:           "bg-purple-100 text-purple-700",
  partially_refunded: "bg-amber-100 text-amber-700",
  failed:             "bg-red-100 text-red-700",
  cancelled:          "bg-gray-100 text-gray-500",
  disputed:           "bg-orange-100 text-orange-700",
}

type Payment = {
  id: string
  status: string
  amount: number
  currency: string
  createdAt: Date | null
}

export async function DashboardPayments({ payments }: { payments: Payment[] }) {
  const t = await getTranslations("compCustomerDashboardPayments")
  const totalSpent = payments
    .filter(p => p.status === "captured")
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5EBF0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#F4FAF6] px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-[#2B3441]">
          <CreditCard size={16} className="text-[#2D7A5F]" /> {t("title")}
        </h2>
        <Link href="/payments" className="text-xs font-medium text-[#2D7A5F] hover:underline">
          {t("fullHistory")}
        </Link>
      </div>

      {totalSpent > 0 && (
        <div className="border-b border-[#F4FAF6] px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">{t("totalSpent")}</span>
          <span className="text-sm font-bold text-[#2B3441]">{formatCurrency(totalSpent)}</span>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#9CA3AF]">{t("emptyState")}</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {payments.map(p => {
            const style = STATUS_COLOR[p.status] ?? "bg-gray-100 text-gray-500"
            const date = p.createdAt
              ? new Date(p.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
              : "—"
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
                    {t.has(`status_${p.status}`) ? t(`status_${p.status}`) : p.status.replace(/_/g, " ")}
                  </span>
                  <p className="mt-0.5 text-xs text-[#9CA3AF]">{date}</p>
                </div>
                <p className="font-bold text-sm text-[#2B3441]">{formatCurrency(p.amount)}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="border-t border-[#F4FAF6] px-5 py-3">
        <Link href="/payments" className="text-xs font-medium text-[#6B7280] hover:text-[#2D7A5F] hover:underline transition-colors">
          {t("viewFullHistory")}
        </Link>
      </div>
    </div>
  )
}
