"use client"

import { useState } from "react"
import { Loader2, Send, CheckCircle2 } from "lucide-react"

type Labels = {
  name: string; email: string; subject: string; message: string
  send: string; sending: string; successTitle: string; successBody: string; error: string
}

export function ContactForm({ labels }: { labels: Labels }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!r.ok) { setError(labels.error); setSending(false); return }
      setSent(true)
    } catch {
      setError(labels.error)
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-8 text-center">
        <CheckCircle2 size={40} className="mx-auto text-[#2D7A5F] mb-3" />
        <p className="font-semibold text-[#2B3441] mb-1">{labels.successTitle}</p>
        <p className="text-sm text-[#6B7280]">{labels.successBody}</p>
      </div>
    )
  }

  const inputCls = "w-full rounded-xl border border-[#E5EBF0] px-4 py-2.5 text-sm focus:border-[#2D7A5F] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
  return (
    <form onSubmit={submit} className="rounded-2xl bg-white border border-[#E5EBF0] shadow-sm p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input required placeholder={labels.name} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
        <input required type="email" placeholder={labels.email} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
      </div>
      <input required placeholder={labels.subject} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className={inputCls} />
      <textarea required rows={6} placeholder={labels.message} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className={inputCls} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold px-5 py-3 transition-colors disabled:opacity-60">
        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {sending ? labels.sending : labels.send}
      </button>
    </form>
  )
}
