export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { storeProducts } from "@/lib/db/schema"
import { asc, desc } from "drizzle-orm"
import Link from "next/link"
import { PlusCircle } from "lucide-react"
import { AdminStoreList } from "@/components/admin/store/AdminStoreList"

async function getProducts() {
  return db.query.storeProducts.findMany({
    orderBy: [asc(storeProducts.sortOrder), desc(storeProducts.createdAt)],
  })
}

export default async function AdminStorePage() {
  const products = await getProducts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Eco-store</h1>
          <p className="text-sm text-[#6B7280] mt-1">Recommended affiliate products &amp; starter packs</p>
        </div>
        <Link
          href="/admin/content/store/new"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#2D7A5F] text-white hover:bg-[#235f49] transition-colors"
        >
          <PlusCircle size={16} /> Add product
        </Link>
      </div>
      <AdminStoreList initialProducts={products} />
    </div>
  )
}
