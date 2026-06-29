export const dynamic = "force-dynamic"

import { auth } from "@clerk/nextjs/server"
import { redirect, notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { db } from "@/lib/db"
import { bookings, payments, providers, providerServices, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { formatCurrencyForCountry } from "@/lib/utils/formatCurrency"
import { formatDate } from "@/lib/utils/formatDate"
import { PrintButton } from "@/components/booking/PrintButton"

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("customerReceiptPage")
  const { id } = await params

  const [b] = await db
    .select({
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      createdAt: bookings.createdAt,
      subtotalAmount: bookings.subtotalAmount,
      discountAmount: bookings.discountAmount,
      carbonOffsetAmount: bookings.carbonOffsetAmount,
      totalAmount: bookings.totalAmount,
      providerBusinessName: providers.businessName,
      providerCountry: providers.country,
      serviceName: providerServices.name,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      customerEmail: users.email,
    })
    .from(bookings)
    .leftJoin(providers, eq(bookings.providerId, providers.id))
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .leftJoin(users, eq(bookings.customerId, users.id))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)))
  if (!b) notFound()

  const [pay] = await db.select({ status: payments.status, capturedAt: payments.capturedAt }).from(payments).where(eq(payments.bookingId, id))

  const country = b.providerCountry ?? "DE"
  const money = (c: number) => formatCurrencyForCountry(c, country)
  const gross = b.subtotalAmount + (b.discountAmount ?? 0)
  const totalPaid = b.totalAmount + (b.carbonOffsetAmount ?? 0)
  const customerName = [b.customerFirstName, b.customerLastName].filter(Boolean).join(" ") || b.customerEmail || "—"

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/bookings/${id}`} className="text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors">← {t("title")}</Link>
        <PrintButton label={t("print")} />
      </div>

      <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-2xl font-bold text-[#2B3441]">DORIXÉ</p>
            <p className="text-[10px] tracking-widest text-[#2D7A5F] font-semibold">CLEAN HOME. GREEN FUTURE.</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-[#2B3441]">{t("title")}</p>
            <p className="text-xs text-[#6B7280]">{t("receiptNo")} {b.bookingNumber}</p>
            <p className="text-xs text-[#6B7280]">{t("date")}: {formatDate(pay?.capturedAt ?? b.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t border-[#F0F4F8] pt-4">
          <div>
            <p className="text-xs text-[#9CA3AF]">{t("billedTo")}</p>
            <p className="text-[#2B3441] font-medium">{customerName}</p>
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF]">{t("cleaner")}</p>
            <p className="text-[#2B3441] font-medium">{b.providerBusinessName ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-[#9CA3AF]">{t("service")}</p>
            <p className="text-[#2B3441] font-medium">{b.serviceName ?? "—"} · {formatDate(b.scheduledAt)}</p>
          </div>
        </div>

        <div className="border-t border-[#F0F4F8] pt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-[#6B7280]">{t("subtotal")}</span><span className="text-[#2B3441]">{money(gross)}</span></div>
          {(b.discountAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-[#6B7280]">{t("discount")}</span><span className="text-[#2D7A5F]">-{money(b.discountAmount)}</span></div>}
          {(b.carbonOffsetAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-[#6B7280]">{t("carbonOffset")}</span><span className="text-[#2B3441]">{money(b.carbonOffsetAmount)}</span></div>}
          <div className="flex justify-between font-bold text-[#2B3441] border-t border-[#F0F4F8] pt-2 text-base"><span>{t("total")}</span><span>{money(totalPaid)}</span></div>
        </div>

        <div className="border-t border-[#F0F4F8] pt-4 text-sm flex justify-between">
          <span className="text-[#6B7280]">{t("status")}</span>
          <span className="font-medium text-[#2B3441] capitalize">{pay?.status ?? b.status}</span>
        </div>

        <p className="text-xs text-[#9CA3AF] border-t border-[#F0F4F8] pt-4">{t("notInvoice")}</p>
      </div>
    </div>
  )
}
