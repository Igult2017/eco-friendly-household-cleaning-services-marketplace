"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, X, ImagePlus, CheckCircle2 } from "lucide-react"

interface BeforePhotoUploadProps {
  bookingId: string
  onComplete?: () => void
}

interface PhotoEntry {
  file: File
  preview: string
}

export function BeforePhotoUpload({ bookingId, onComplete }: BeforePhotoUploadProps) {
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newEntries = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos((prev) => [...prev, ...newEntries])
    if (e.target) e.target.value = ""
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleUpload() {
    if (photos.length === 0) return
    setUploading(true)
    setError(null)

    try {
      const publicUrls: string[] = []

      for (const entry of photos) {
        const presignedRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: entry.file.type,
            contentLength: entry.file.size,
            folder: "completions",
          }),
        })

        if (!presignedRes.ok) {
          const data = await presignedRes.json().catch(() => ({}))
          throw new Error(data.error ?? "Failed to get upload URL")
        }

        const { uploadUrl, publicUrl } = await presignedRes.json()

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: entry.file,
          headers: { "Content-Type": entry.file.type },
        })

        if (!putRes.ok) throw new Error("Failed to upload file to storage")

        publicUrls.push(publicUrl)
      }

      const saveRes = await fetch(`/api/bookings/${bookingId}/before-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls: publicUrls }),
      })

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}))
        throw new Error(data.error ?? "Failed to save photos")
      }

      setSaved(true)
      onComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-6">
      <h2 className="font-serif text-lg font-bold text-[#2B3441] mb-1">Before-Service Photos</h2>
      <p className="text-sm text-[#6B7280] mb-4">
        Document the space before you begin. These photos protect you in case of disputes.
      </p>

      {/* Thumbnail grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-[#F4FAF6]">
              <img src={p.preview} alt={`Before photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                disabled={uploading}
                className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File input trigger */}
      {!saved && (
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <div className="flex items-center gap-2 text-sm text-[#2D7A5F] font-medium hover:text-[#235f49] transition-colors">
            <ImagePlus size={16} />
            <span>Select photos</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      {/* Success */}
      {saved && (
        <div className="flex items-center gap-2 mt-3 text-sm font-medium text-[#2D7A5F]">
          <CheckCircle2 size={16} />
          <span>Photos saved</span>
        </div>
      )}

      {/* Upload button */}
      {!saved && photos.length > 0 && (
        <Button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="mt-4 bg-[#2D7A5F] hover:bg-[#235f49] text-white h-10 px-5"
        >
          {uploading ? (
            <>
              <Loader2 size={15} className="animate-spin mr-2" />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={15} className="mr-2" />
              Upload {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
