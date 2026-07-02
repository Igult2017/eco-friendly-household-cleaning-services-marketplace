"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { StoreProduct } from "@/lib/db/schema"
import { ImageUploadField } from "./ImageUploadField"
import { BenefitsEditor } from "./BenefitsEditor"

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD"]

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200)
}

// Surface either the API's plain { error: string } or a zod flatten ({ formErrors, fieldErrors }).
function readError(d: unknown): string {
  const e = (d as { error?: unknown })?.error
  if (typeof e === "string") return e
  if (e && typeof e === "object") {
    const f = e as { formErrors?: string[]; fieldErrors?: Record<string, string[]> }
    const form = f.formErrors?.filter(Boolean) ?? []
    const fields = Object.entries(f.fieldErrors ?? {}).map(
      ([k, v]) => `${k}: ${(v ?? []).join(", ")}`
    )
    const all = [...form, ...fields].filter(Boolean)
    if (all.length) return all.join(" · ")
  }
  return "Save failed. Check all fields."
}

export function StoreProductForm({ initial }: { initial?: StoreProduct }) {
  const router = useRouter()
  const [type, setType] = useState<"product" | "starter_pack">(initial?.type ?? "product")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug))
  const [brand, setBrand] = useState(initial?.brand ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [category, setCategory] = useState(initial?.category ?? "")
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "))
  const [price, setPrice] = useState(
    initial?.priceCents != null ? (initial.priceCents / 100).toString() : ""
  )
  const [currency, setCurrency] = useState(initial?.currency ?? "")
  const [affiliateUrl, setAffiliateUrl] = useState(initial?.affiliateUrl ?? "")
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "")
  const [benefits, setBenefits] = useState<string[]>(initial?.benefits ?? [])
  const [packId, setPackId] = useState(initial?.packId ?? "")
  const [packs, setPacks] = useState<{ id: string; title: string }[]>([])
  const [featured, setFeatured] = useState(initial?.featured ?? false)
  const [published, setPublished] = useState(initial?.status === "published")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Starter packs a product can belong to (a pack is a titled LIST of products).
  useEffect(() => {
    fetch("/api/admin/store")
      .then((r) => r.json())
      .then((d) => {
        const rows: StoreProduct[] = d.products ?? []
        setPacks(rows.filter((p) => p.type === "starter_pack" && p.id !== initial?.id).map((p) => ({ id: p.id, title: p.title })))
      })
      .catch(() => {})
  }, [initial?.id])

  function onTitleChange(v: string) {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function save() {
    setSaving(true)
    setError("")
    const priceCents =
      price.trim() === "" ? null : Math.round(parseFloat(price) * 100)
    if (priceCents != null && Number.isNaN(priceCents)) {
      setError("Price must be a number.")
      setSaving(false)
      return
    }
    const body = {
      type,
      title,
      slug: slug || undefined,
      description: description || undefined,
      brand: brand || undefined,
      imageUrl: imageUrl || undefined,
      affiliateUrl,
      priceCents,
      currency: currency || undefined,
      benefits: benefits.map((b) => b.trim()).filter(Boolean),
      category: category || undefined,
      packId: type === "product" && packId ? packId : null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      featured,
      status: published ? "published" : "draft",
    }
    try {
      const res = initial?.id
        ? await fetch(`/api/admin/store/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
      if (!res.ok) {
        setError(readError(await res.json().catch(() => ({}))))
        setSaving(false)
        return
      }
      router.push("/admin/content/store")
      router.refresh()
    } catch {
      setError("Network error")
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as "product" | "starter_pack")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="starter_pack">Starter Pack</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Ecover" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Product name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
            placeholder="url-friendly-slug"
          />
        </div>
      </div>

      <ImageUploadField value={imageUrl} onChange={setImageUrl} onError={setError} />

      <div className="space-y-1.5">
        <Label htmlFor="affiliateUrl">Affiliate URL</Label>
        <Input
          id="affiliateUrl"
          type="url"
          value={affiliateUrl}
          onChange={(e) => setAffiliateUrl(e.target.value)}
          placeholder={type === "starter_pack" ? "https://… (optional — the pack's products carry their own links)" : "https://… (required)"}
        />
      </div>

      {type === "product" && packs.length > 0 && (
        <div className="space-y-1.5">
          <Label>Part of starter pack</Label>
          <Select value={packId || "none"} onValueChange={(v) => setPackId(!v || v === "none" ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— none (standalone product) —</SelectItem>
              {packs.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[#9CA3AF]">Products in a pack are listed under the pack&apos;s title on the eco-store (up to 20 per pack).</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description shown on the listing…"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Cleaning, Tools…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="eco, refill, vegan" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="price">Price (optional)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 12.99 — leave blank for none"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency || "none"} onValueChange={(v) => setCurrency(v && v !== "none" ? v : "")}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              {currency && !CURRENCIES.includes(currency) && (
                <SelectItem value={currency}>{currency}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Benefits panel for EVERY listing — shown under the product on the store page. */}
      <BenefitsEditor benefits={benefits} onChange={setBenefits} />

      <div className="flex flex-wrap items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Switch checked={featured} onCheckedChange={setFeatured} />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Switch checked={published} onCheckedChange={setPublished} />
          Published
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          onClick={save}
          disabled={saving || !title || (type === "product" && !affiliateUrl)}
          className="bg-[#2D7A5F] hover:bg-[#235f49] text-white"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : initial?.id ? (
            "Save changes"
          ) : (
            "Create product"
          )}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
