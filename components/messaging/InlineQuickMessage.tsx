"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Design rule: "send a message" actions expand IN PLACE — never bounce the user to another page.
// Collapsed it's a button; expanded it's a composer posting straight into the conversation, with
// a link to the full chat for anything longer.
export function InlineQuickMessage({
  endpoint,
  chatHref,
  label,
  variant = "link",
}: {
  endpoint: string
  chatHref: string
  label: string
  variant?: "primary" | "link"
}) {
  const t = useTranslations("compInlineQuickMessage")
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!body.trim()) return
    setState("sending")
    setError(null)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === "string" ? d.error : t("failed"))
        setState("idle")
        return
      }
      setBody("")
      setState("sent")
    } catch {
      setError(t("failed"))
      setState("idle")
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 transition-colors",
          variant === "primary"
            ? "rounded-xl bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#235f49]"
            : "text-sm font-medium text-[#2D7A5F] hover:underline",
        )}
      >
        <MessageSquare size={14} /> {label}
      </button>

      {open && (
        <div className="mt-2 w-full rounded-xl border border-[#E5EBF0] bg-white p-3">
          {state === "sent" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[#2D7A5F]">
                <CheckCircle2 size={14} /> {t("sent")}
              </p>
              <button type="button" onClick={() => setState("idle")} className="text-xs text-[#6B7280] underline hover:text-[#2B3441]">
                {t("writeAnother")}
              </button>
              <Link href={chatHref} className="text-xs text-[#6B7280] underline hover:text-[#2B3441]">
                {t("openChat")}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send() } }}
                  placeholder={t("placeholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-[#E5EBF0] bg-[#F4FAF6] px-3 py-2 text-sm text-[#2B3441] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#2D7A5F]"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={state === "sending" || !body.trim()}
                  aria-label={t("send")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2D7A5F] text-white transition-colors hover:bg-[#235f49] disabled:opacity-50"
                >
                  {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
              <Link href={chatHref} className="mt-1.5 inline-block text-xs text-[#6B7280] underline hover:text-[#2B3441]">
                {t("openChat")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
