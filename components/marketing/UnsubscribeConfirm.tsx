"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, MailX } from "lucide-react"

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")

  async function confirm() {
    setState("busy")
    try {
      const r = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" })
      setState(r.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <>
        <CheckCircle2 className="w-12 h-12 text-[#2D7A5F] mx-auto mb-4" />
        <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">You&apos;re unsubscribed</h1>
        <p className="text-sm text-[#6B7280] leading-relaxed">
          You won&apos;t receive marketing emails from DORIXÉ anymore. You&apos;ll still get essential
          account and booking notifications.
        </p>
        <Link href="/" className="inline-block mt-6 text-sm font-semibold text-[#2D7A5F] hover:underline">← Back to DORIXÉ</Link>
      </>
    )
  }

  return (
    <>
      <MailX className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
      <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">Unsubscribe from marketing emails?</h1>
      <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
        You&apos;ll stop receiving marketing emails from DORIXÉ. Essential account and booking emails will still arrive.
      </p>
      {state === "error" && <p className="text-sm text-red-500 mb-3">That link looks invalid or expired. Please use the link from your most recent email.</p>}
      <button
        onClick={confirm}
        disabled={state === "busy"}
        className="inline-flex items-center gap-2 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] text-white text-sm font-semibold px-6 py-3 transition-colors disabled:opacity-60"
      >
        {state === "busy" ? <Loader2 size={15} className="animate-spin" /> : <MailX size={15} />} Confirm unsubscribe
      </button>
      <div><Link href="/" className="inline-block mt-6 text-sm text-[#6B7280] hover:underline">Keep my subscription</Link></div>
    </>
  )
}
