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

export default async function ProviderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")
  const t = await getTranslations("providerReceiptPage")
  const { id } = await params

  const [provider] = await db.select({ id: providers.id, businessName: providers.businessName, country: providers.country }).from(providers).where(eq(providers.userId, userId))
  if (!provider) redirect("/provider/profile")

  const [b] = await db
    .select({
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      createdAt: bookings.createdAt,
      subtotalAmount: bookings.subtotalAmount,
      platformFeeAmount: bookings.platformFeeAmount,
      providerPayout: bookings.providerPayout,
      serviceName: providerServices.name,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
    })
    .from(bookings)
    .leftJoin(providerServices, eq(bookings.serviceId, providerServices.id))
    .leftJoin(users, eq(bookings.customerId, users.id))
    .where(and(eq(bookings.id, id), eq(bookings.providerId, provider.id)))
  if (!b) notFound()

  const [pay] = await db.select({ status: payments.status, capturedAt: payments.capturedAt }).from(payments).where(eq(payments.bookingId, id))

  const country = provider.country ?? "DE"
  const money = (c: number) => formatCurrencyForCountry(c, country)
  const clientName = [b.customerFirstName, b.customerLastName?.[0]].filter(Boolean).join(" ") || "—"

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/provider/bookings" className="text-sm text-[#6B7280] hover:text-[#2D7A5F] transition-colors">← {t("title")}</Link>
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
            <p className="text-xs text-[#9CA3AF]">{t("client")}</p>
            <p className="text-[#2B3441] font-medium">{clientName}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-[#9CA3AF]">{t("service")}</p>
            <p className="text-[#2B3441] font-medium">{b.serviceName ?? "—"} · {formatDate(b.scheduledAt)}</p>
          </div>
        </div>

        <div className="border-t border-[#F0F4F8] pt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-[#6B7280]">{t("grossEarnings")}</span><span className="text-[#2B3441]">{money(b.subtotalAmount)}</span></div>
          <div className="flex justify-between"><span className="text-[#6B7280]">{t("commission")}</span><span className="text-[#2B3441]">-{money(b.platformFeeAmount)}</span></div>
          <div className="flex justify-between font-bold text-[#2D7A5F] border-t border-[#F0F4F8] pt-2 text-base"><span>{t("netPayout")}</span><span>{money(b.providerPayout)}</span></div>
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
