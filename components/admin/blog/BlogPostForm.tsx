"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { BlogEditor } from "@/components/blog/BlogEditor"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

type PostData = {
  id?: string
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  coverImageUrl?: string
  category?: string
  tags?: string[]
  allowComments?: boolean
  allowSharing?: boolean
}

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200)
}

export function BlogPostForm({ initial }: { initial?: PostData }) {
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "")
  const [content, setContent] = useState(initial?.content ?? "")
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "")
  const [category, setCategory] = useState(initial?.category ?? "")
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "))
  const [allowComments, setAllowComments] = useState(initial?.allowComments ?? true)
  const [allowSharing, setAllowSharing] = useState(initial?.allowSharing ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  function onTitleChange(v: string) {
    setTitle(v)
    if (!initial?.slug) setSlug(slugify(v))
  }

  // Upload a cover image to our own storage (same presigned flow as in-article images),
  // so admins can either paste a URL or upload a file.
  async function uploadCover(file: File) {
    setCoverUploading(true)
    setError("")
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, contentLength: file.size, folder: "blog-covers" }),
      })
      if (!presignRes.ok) throw new Error()
      const { uploadUrl, publicUrl } = await presignRes.json()
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      setCoverImageUrl(publicUrl)
    } catch {
      setError("Cover image upload failed")
    } finally {
      setCoverUploading(false)
    }
  }

  // Paste an image straight from the clipboard (a screenshot or a copied photo) → upload it.
  // If the clipboard holds text (e.g. a URL) instead, let the normal paste happen.
  function onCoverPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          uploadCover(file)
          return
        }
      }
    }
  }

  async function save(publish?: boolean) {
    setSaving(true)
    setError("")
    const body = {
      title, slug, excerpt, content,
      coverImageUrl: coverImageUrl || undefined,
      category: category || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      allowComments, allowSharing,
    }
    try {
      let res: Response
      if (initial?.id) {
        res = await fetch(`/api/admin/blog/${initial.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      } else {
        res = await fetch("/api/admin/blog", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const d = await res.json()
        setError(typeof d.error === "string" ? d.error : "Save failed. Check all fields.")
        setSaving(false)
        return
      }
      const d = await res.json()
      const id = initial?.id ?? d.post?.id
      if (publish && id) {
        await fetch(`/api/admin/blog/${id}/publish`, { method: "PATCH" })
      }
      router.push("/admin/content/blog")
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
          <Label>Title</Label>
          <Input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Article title" />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="url-friendly-slug" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cover image</Label>
        <div className="flex gap-2">
          <Input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            onPaste={onCoverPaste}
            placeholder="Paste an image (Ctrl+V) or a URL — or click Upload →"
            className="flex-1"
          />
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = "" }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => coverInputRef.current?.click()}
            disabled={coverUploading}
            className="shrink-0"
          >
            {coverUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
            alt="Cover preview"
            className="mt-2 h-36 w-full max-w-md rounded-lg object-cover border border-gray-200"
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Tips, News, Eco…" />
        </div>
        <div className="space-y-1.5">
          <Label>Tags (comma-separated)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cleaning, eco, tips" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Excerpt</Label>
        <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short description shown in card…" rows={2} className="resize-none" />
      </div>

      <div className="space-y-1.5">
        <Label>Content</Label>
        <BlogEditor value={content} onChange={setContent} />
      </div>

      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Switch checked={allowComments} onCheckedChange={setAllowComments} />
          Allow comments
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Switch checked={allowSharing} onCheckedChange={setAllowSharing} />
          Allow sharing
        </label>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={() => save()} disabled={saving || !title || !slug} className="bg-[#2B3441] hover:bg-[#1e2630] text-white">
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button onClick={() => save(true)} disabled={saving || !title || !slug} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
          {saving ? "Saving…" : "Save & publish"}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>Cancel</Button>
      </div>
    </div>
  )
}
