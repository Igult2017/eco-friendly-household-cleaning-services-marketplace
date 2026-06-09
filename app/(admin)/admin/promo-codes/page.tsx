import { db } from "@/lib/db"
import { promoCodes } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { Tag } from "lucide-react"
import { PromoCodeCreateForm } from "@/components/admin/PromoCodeCreateForm"
import { PromoCodeTable } from "@/components/admin/PromoCodeTable"

async function getCodes() {
  return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt))
}

export default async function AdminPromoCodesPage() {
  const codes = await getCodes()

  const active = codes.filter((c) => c.isActive).length
  const inactive = codes.length - active

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Promo Codes</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Create and manage discount codes for customers</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-[#E5EBF0] bg-white px-5 py-3 shadow-sm text-center">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Active</p>
            <p className="mt-0.5 text-2xl font-bold text-[#2D7A5F]">{active}</p>
          </div>
          <div className="rounded-xl border border-[#E5EBF0] bg-white px-5 py-3 shadow-sm text-center">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Inactive</p>
            <p className="mt-0.5 text-2xl font-bold text-[#2B3441]">{inactive}</p>
          </div>
          <div className="rounded-xl border border-[#E5EBF0] bg-white px-5 py-3 shadow-sm text-center">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Total</p>
            <p className="mt-0.5 text-2xl font-bold text-[#2B3441]">{codes.length}</p>
          </div>
        </div>
      </div>

      {/* Create Form */}
      <PromoCodeCreateForm />

      {/* Table */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Tag className="h-5 w-5 text-[#2D7A5F]" />
          <h2 className="font-serif text-xl font-bold text-[#2B3441]">All Promo Codes</h2>
        </div>
        <PromoCodeTable codes={codes} />
      </div>
    </div>
  )
}
