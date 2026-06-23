"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sparkles, Loader2, Send, Save } from "lucide-react"
import { AudienceBuilder } from "./AudienceBuilder"
import type { AudienceFilter, CampaignType } from "@/lib/marketing/types"

const TYPES: { v: CampaignType; label: string }[] = [
  { v: "value", label: "Value email" },
  { v: "soft_sell", label: "Soft sell" },
  { v: "hard_sell", label: "Hard sell" },
  { v: "custom", label: "Custom" },
  { v: "welcome", label: "Welcome (manual)" },
]
const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"

export function CampaignComposer() {
  const router = useRouter()
  const [type, setType] = useState<CampaignType>("value")
  const [name, setName] = useState("")
  const [brief, setBrief] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [personalize, setPersonalize] = useState(true)
  const [audience, setAudience] = useState<AudienceFilter>({ onlyConsented: true })
  const [busy, setBusy] = useState<"ai" | "save" | "send" | null>(null)

  async function generate() {
    setBusy("ai")
    try {
      const r = await fetch("/api/admin/marketing/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, brief }) })
      const d = await r.json()
      if (r.ok) { setSubject(d.subject); setBodyHtml(d.html); toast.success("AI draft ready — edit freely") }
      else toast.error(d.error ?? "Generation failed (is GEMINI_API_KEY set?)")
    } finally { setBusy(null) }
  }

  async function submit(send: boolean) {
    if (!name.trim()) return toast.error("Name your campaign")
    setBusy(send ? "send" : "save")
    try {
      const r = await fetch("/api/admin/marketing/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, subject, brief, bodyHtml, aiGenerated: !!bodyHtml, personalizePerUser: personalize, audience }),
      })
      const d = await r.json()
      if (!r.ok) { toast.error(d.error?.formErrors?.join(", ") ?? "Save failed"); return }
      if (send) {
        const s = await fetch(`/api/admin/marketing/campaigns/${d.id}/send`, { method: "POST" })
        if (s.ok) toast.success("Campaign sending — AI personalizes each email")
        else toast.error((await s.json()).error ?? "Send failed")
      } else toast.success("Draft saved")
      setName(""); setBrief(""); setSubject(""); setBodyHtml("")
      router.refresh()
    } finally { setBusy(null) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-[#2B3441]">New campaign</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-[#6B7280]">Campaign name
          <input className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. March eco-tips value email" />
        </label>
        <label className="text-xs text-[#6B7280]">Type
          <select className={`${inputCls} mt-1`} value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <label className="text-xs text-[#6B7280] block">Brief for the AI (intent, offer, angle)
        <textarea className={`${inputCls} mt-1 min-h-[70px]`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What should this email achieve? Any offer, product, or angle to emphasize." />
      </label>

      <button type="button" onClick={generate} disabled={busy === "ai"} className="inline-flex items-center gap-2 rounded-lg bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
        {busy === "ai" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate with AI
      </button>

      {(subject || bodyHtml) && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <label className="text-xs text-[#6B7280] block">Subject
            <input className={`${inputCls} mt-1`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="text-xs text-[#6B7280] block">Body (HTML — base/preview; AI rewrites uniquely per recipient when personalization is on)
            <textarea className={`${inputCls} mt-1 min-h-[140px] font-mono text-xs`} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
          </label>
          {bodyHtml && <div className="rounded-xl border border-gray-100 p-4 text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml }} />}
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[#6B7280]">
        <input type="checkbox" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} />
        Personalize per recipient with AI (unique copy — best for deliverability / anti-spam)
      </label>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-[#2B3441] mb-2">Audience</p>
        <AudienceBuilder value={audience} onChange={setAudience} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => submit(false)} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 text-[#2B3441] text-sm font-semibold px-4 py-2 disabled:opacity-50">
          {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save draft
        </button>
        <button type="button" onClick={() => submit(true)} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-[#2B3441] hover:bg-black text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
          {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Create &amp; send
        </button>
      </div>
    </div>
  )
}
