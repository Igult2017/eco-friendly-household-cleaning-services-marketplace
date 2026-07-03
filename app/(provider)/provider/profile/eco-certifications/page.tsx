"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { Upload, Loader2, Plus, CheckCircle } from "lucide-react"
import { BackButton } from "@/components/ui/BackButton"

type Cert = {
  id: string
  name: string
  issuingBody: string | null
  certificationNumber: string | null
  documentUrl: string
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
}

const EMPTY = { name: "", issuingBody: "", certificationNumber: "", documentUrl: "", expiresAt: "" }

export default function EcoCertificationsPage() {
  const t = useTranslations("providerProviderProfileEcocertificationsPage")
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => {
    setLoading(true)
    fetch("/api/provider/certifications").then((r) => r.json()).then((d) => { setCerts(d.certifications ?? []); setLoading(false) })
  }

  useEffect(() => { reload() }, [])

  const uploadFile = async (file: File) => {
    setUploading(true)
    const res = await fetch(`/api/upload/presigned?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)
    const { url, publicUrl } = await res.json()
    await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
    setForm((f) => ({ ...f, documentUrl: publicUrl }))
    setUploading(false)
  }

  const save = async () => {
    if (!form.name || !form.documentUrl) { setError(t("errorNameAndDocumentRequired")); return }
    setSaving(true)
    setError(null)
    const res = await fetch("/api/provider/certifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, expiresAt: form.expiresAt || undefined }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error?.formErrors?.[0] ?? t("errorFailedToSave")) }
    else { setForm(EMPTY); setShowForm(false); reload() }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-1"><BackButton fallback="/provider/profile" /></div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">{t("title")}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[#2D7A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#256349] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("addCertificate")}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white shadow-sm p-6 space-y-4 border border-[#2D7A5F]/20">
          <h2 className="font-semibold text-[#2B3441]">{t("newCertification")}</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("labelCertificateName")}</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("placeholderCertificateName")} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("labelIssuingBody")}</label>
                <input type="text" value={form.issuingBody} onChange={(e) => setForm((f) => ({ ...f, issuingBody: e.target.value }))} placeholder={t("placeholderIssuingBody")} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("labelCertificateNumber")}</label>
                <input type="text" value={form.certificationNumber} onChange={(e) => setForm((f) => ({ ...f, certificationNumber: e.target.value }))} placeholder={t("placeholderCertificateNumber")} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("labelExpiryDate")}</label>
              <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#2B3441] mb-1.5">{t("labelDocument")}</label>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-4 py-3 text-sm text-[#6B7280] hover:border-[#2D7A5F] hover:text-[#2D7A5F] transition-colors w-full"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? t("uploading") : form.documentUrl ? t("documentUploaded") : t("uploadCertificate")}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(null) }} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-[#6B7280] hover:bg-gray-50">{t("cancel")}</button>
            <button onClick={save} disabled={saving || uploading} className="flex-1 rounded-xl bg-[#2D7A5F] py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#256349] transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#2D7A5F]" /></div>
        ) : certs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[#6B7280] text-sm">{t("emptyState")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {certs.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-[#2B3441]">{c.name}</p>
                    {c.verifiedAt
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"><CheckCircle className="h-3 w-3" />{t("statusVerified")}</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{t("statusPending")}</span>
                    }
                  </div>
                  {c.issuingBody && <p className="text-xs text-[#6B7280] mt-0.5">{c.issuingBody}</p>}
                  {c.expiresAt && <p className="text-xs text-[#6B7280]">{t("expires", { date: c.expiresAt })}</p>}
                </div>
                <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2D7A5F] hover:underline font-medium">{t("viewDoc")}</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
