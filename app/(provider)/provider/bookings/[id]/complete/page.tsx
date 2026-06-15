"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Upload, Loader2, X, Camera } from "lucide-react"
import { BeforePhotoUpload } from "@/components/booking/BeforePhotoUpload"

export default function MarkCompletePage() {
  const t = useTranslations("providerProviderBookingsIdCompletePage")
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const bookingId = params.id

  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadPhoto(file: File): Promise<string> {
    const presignedRes = await fetch("/api/upload/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: file.type, contentLength: file.size, folder: "completion-photos" }),
    })
    const { uploadUrl, publicUrl } = await presignedRes.json()
    await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
    return publicUrl
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newPhotos = files.slice(0, 5 - photos.length).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos((prev) => [...prev, ...newPhotos])
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      setUploading(true)
      const photoUrls: string[] = []
      for (const photo of photos) {
        const url = await uploadPhoto(photo.file)
        photoUrls.push(url)
      }
      setUploading(false)

      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? t("errorMarkComplete"))
        return
      }
      setDone(true)
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-16 h-16 bg-[#D1F0E0] rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-[#2D7A5F]" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("doneTitle")}</h1>
        <p className="text-[#6B7280] mb-8 max-w-sm">
          {t("donePayment")}
        </p>
        <Button onClick={() => router.push("/provider/dashboard")} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white px-8 h-11">
          {t("backToDashboard")}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto py-6">
      <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">{t("title")}</h1>
      <p className="text-[#6B7280] mb-8">{t("subtitle")}</p>

      <BeforePhotoUpload bookingId={bookingId} />

      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-5 mb-4">
        <Label className="text-sm font-semibold text-[#2B3441] mb-3 flex items-center gap-2">
          <Camera size={15} /> {t("completionPhotosLabel")}
        </Label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-[#F4FAF6]">
              <img src={p.preview} alt={t("photoAlt")} className="w-full h-full object-cover" />
              <button
                onClick={() => removePhoto(i)}
                aria-label={t("removePhoto")}
                className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-[#E5EBF0] flex flex-col items-center justify-center cursor-pointer hover:border-[#4CB87A] transition-colors">
              <Upload size={20} className="text-[#9CA3AF] mb-1" />
              <span className="text-xs text-[#9CA3AF]">{t("addPhoto")}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
          )}
        </div>
        <p className="text-xs text-[#9CA3AF]">{t("photosHelp")}</p>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()} className="flex-1 h-11 border-[#E5EBF0]">{t("cancel")}</Button>
        <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11 bg-[#2D7A5F] hover:bg-[#235f49] text-white">
          {submitting
            ? <><Loader2 size={16} className="animate-spin mr-2" />{uploading ? t("uploading") : t("completing")}</>
            : <><CheckCircle2 size={16} className="mr-2" /> {t("confirmComplete")}</>}
        </Button>
      </div>
    </div>
  )
}
