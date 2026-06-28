"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Globe, EyeOff, Star, PlusCircle, ImageIcon } from "lucide-react"
import type { StoreProduct } from "@/lib/db/schema"
import { DeleteStoreProductDialog } from "./DeleteStoreProductDialog"

export function AdminStoreList({ initialProducts }: { initialProducts: StoreProduct[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/store/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) setError("Couldn't update the product. Please try again.")
      return res.ok
    } catch {
      setError("Network error. Please try again.")
      return false
    } finally {
      setBusy(null)
    }
  }

  async function togglePublish(p: StoreProduct) {
    const next = p.status === "published" ? "draft" : "published"
    if (await patch(p.id, { status: next })) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, status: next } : x)))
    }
  }

  async function toggleFeatured(p: StoreProduct) {
    const next = !p.featured
    if (await patch(p.id, { featured: next })) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, featured: next } : x)))
    }
  }

  function onDeleted(id: string) {
    setProducts((list) => list.filter((x) => x.id !== id))
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5EBF0] px-6 py-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF5F0]">
          <ImageIcon className="h-6 w-6 text-[#2D7A5F]" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-[#2B3441]">No products yet</h3>
        <p className="mt-1 text-sm text-[#6B7280]">
          Add your first recommended product or starter pack to the eco-store.
        </p>
        <Link
          href="/admin/content/store/new"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#2D7A5F] text-white hover:bg-[#235f49] transition-colors"
        >
          <PlusCircle size={16} /> Add product
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-x-auto">
      {error && (
        <p role="alert" className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="overflow-x-auto -mx-px"><table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5EBF0] bg-[#F8FAFB]">
            <th className="text-left px-5 py-3 font-semibold text-[#2B3441]">Product</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Type</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Status</th>
            <th className="text-center px-4 py-3 font-semibold text-[#2B3441]">Featured</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Category</th>
            <th className="text-right px-4 py-3 font-semibold text-[#2B3441]">Clicks</th>
            <th className="text-right px-5 py-3 font-semibold text-[#2B3441]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5EBF0]">
          {products.map((p) => {
            const isLoading = busy === p.id
            return (
              <tr key={p.id} className="hover:bg-[#F8FAFB] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 max-w-xs">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover border border-[#E5EBF0]"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F4] text-[#9CA3AF]">
                        <ImageIcon size={16} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-[#2B3441] truncate">{p.title}</p>
                      <p className="text-xs text-[#9CA3AF] truncate">/{p.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={
                      p.type === "starter_pack"
                        ? "bg-[#F3EFFB] text-[#6D4AC2] border-[#6D4AC2]/20"
                        : "bg-[#EEF3F8] text-[#3A6EA5] border-[#3A6EA5]/20"
                    }
                  >
                    {p.type === "starter_pack" ? "Starter Pack" : "Product"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={
                      p.status === "published"
                        ? "bg-[#EDF5F0] text-[#2D7A5F] border-[#2D7A5F]/20"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                  >
                    {p.status === "published" ? "Published" : "Draft"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleFeatured(p)}
                    disabled={isLoading}
                    title={p.featured ? "Unfeature" : "Mark as featured"}
                    aria-label={p.featured ? `Unfeature ${p.title}` : `Feature ${p.title}`}
                    aria-pressed={p.featured}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Star
                      size={15}
                      className={p.featured ? "fill-amber-400 text-amber-400" : ""}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-[#6B7280]">{p.category || "—"}</td>
                <td className="px-4 py-3 text-right text-[#6B7280]">{p.clicks}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => togglePublish(p)}
                      disabled={isLoading}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      {p.status === "published" ? <EyeOff size={12} /> : <Globe size={12} />}
                      {p.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Link
                      href={`/admin/content/store/${p.id}/edit`}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#6B7280] hover:bg-gray-100 transition-colors"
                      title="Edit"
                      aria-label={`Edit ${p.title}`}
                    >
                      <Pencil size={12} />
                    </Link>
                    <DeleteStoreProductDialog id={p.id} title={p.title} onDeleted={() => onDeleted(p.id)} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
    </div>
  )
}
