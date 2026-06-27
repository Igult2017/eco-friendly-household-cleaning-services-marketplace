"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

/**
 * Image input: paste/type a URL, or upload a file via the same presigned flow as the blog cover.
 * POST /api/upload/presigned { contentType, contentLength, folder: "store-images" } → PUT → publicUrl.
 */
export function ImageUploadField({
  value,
  onChange,
  onError,
}: {
  value: string
  onChange: (url: string) => void
  onError: (msg: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setUploading(true)
    onError("")
    try {
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, contentLength: file.size, folder: "store-images" }),
      })
      if (!presignRes.ok) throw new Error()
      const { uploadUrl, publicUrl } = await presignRes.json()
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
      onChange(publicUrl)
    } catch {
      onError("Image upload failed")
    } finally {
      setUploading(false)
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          upload(file)
          return
        }
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>Image</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          placeholder="Paste an image (Ctrl+V) or a URL — or click Upload →"
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "" }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0"
        >
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="Product preview"
          className="mt-2 h-36 w-full max-w-md rounded-lg object-cover border border-gray-200"
        />
      )}
    </div>
  )
}
