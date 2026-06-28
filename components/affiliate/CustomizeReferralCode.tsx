"use client"

import { useState, useEffect, useRef } from "react"
import { Check, Loader2, Pencil } from "lucide-react"
import { normalizeRefCode } from "@/lib/referrals/code"

type Status = "idle" | "checking" | "available" | "unavailable"

export function CustomizeReferralCode({
  currentCode,
  onSaved,
}: {
  currentCode: string
  onSaved: (code: string) => void
}) {
  const [value, setValue] = useState(currentCode)
  const [status, setStatus] = useState<Status>("idle")
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalized = normalizeRefCode(value)
  const changed = normalized !== currentCode.toLowerCase()

  useEffect(() => {
    setSaved(false)
    if (!changed) { setStatus("idle"); setMsg(null); return }
    setStatus("checking"); setMsg(null)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/referrals/code?code=${encodeURIComponent(normalized)}`)
        const d = await r.json()
        if (d.available) { setStatus("available"); setMsg(null) }
        else { setStatus("unavailable"); setMsg(d.error ?? "Not available") }
      } catch { setStatus("idle") }
    }, 400)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [normalized, changed])

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch("/api/referrals/code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      })
      const d = await r.json()
      if (!r.ok) { setMsg(d.error ?? "Couldn't save."); setStatus("unavailable"); return }
      onSaved(d.code)
      setValue(d.code)
      setStatus("idle")
      setSaved(true)
    } catch {
      setMsg("Network error — please try again.")
    } finally {
      setSaving(false)
    }
  }

  const canSave = changed && status === "available" && !saving

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <Pencil className="h-4 w-4 text-[#2D7A5F]" />
        <h2 className="font-semibold text-[#2B3441]">Customize your link</h2>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Make your link personal to your audience — your name or handle — so it doesn't look generic.
      </p>

      <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Your handle</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-[#E5EBF0] bg-white px-3 focus-within:ring-2 focus-within:ring-[#2D7A5F]/30">
          <span className="font-mono text-sm text-[#9CA3AF] shrink-0">…/?ref=</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="your-name"
            maxLength={24}
            aria-label="Custom referral handle"
            className="flex-1 min-w-0 font-mono text-sm py-2.5 pl-1 text-[#2B3441] outline-none bg-transparent"
          />
        </div>
        <button
          onClick={save}
          disabled={!canSave}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2D7A5F] text-white px-6 py-2.5 text-sm font-semibold hover:bg-[#235f49] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>

      <div className="mt-2 min-h-[1.25rem] text-xs">
        {status === "checking" && <span className="text-[#9CA3AF]">Checking availability…</span>}
        {status === "available" && (
          <span className="inline-flex items-center gap-1 text-[#2D7A5F]"><Check className="h-3 w-3" /> "{normalized}" is available</span>
        )}
        {status === "unavailable" && msg && <span className="text-red-600">{msg}</span>}
        {saved && (
          <span className="inline-flex items-center gap-1 text-[#2D7A5F]"><Check className="h-3 w-3" /> Saved — your link is updated.</span>
        )}
        {!changed && !saved && status === "idle" && <span className="text-[#9CA3AF]">This is your current handle.</span>}
      </div>

      <p className="mt-3 text-xs text-[#9CA3AF]">
        Heads up: changing your handle means links you've already shared with the old one stop being credited.
      </p>
    </div>
  )
}
