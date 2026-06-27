import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { StoreProductForm } from "@/components/admin/store/StoreProductForm"

export default function NewStoreProductPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <Link
        href="/admin/content/store"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] mb-6"
      >
        <ChevronLeft size={14} /> Eco-store
      </Link>
      <h1 className="text-2xl font-bold text-[#2B3441] mb-6">Add product</h1>
      <StoreProductForm />
    </main>
  )
}
