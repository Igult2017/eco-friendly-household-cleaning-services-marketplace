"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { LifeBuoy, Loader2, CheckCircle2 } from "lucide-react"

// Message the DORIXÉ team without leaving the page. Shared by ChatActions (inside a booking's chat)
// and the booking detail pages — one implementation. When bookingId is given, the message is tagged
// with that job so admin isn't left guessing which one it's about (see /api/support/messages).
export function ContactSupportPanel({
  side,
  bookingId,
  triggerClassName,
}: {
  side: "client" | "cleaner"
  bookingId?: string
  triggerClassName?: string
}) {
  const t = useTranslations("compChatActions")
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")

  async function send() {
    if (!body.trim()) return
    setState("sending")
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), bookingId }),
      })
      if (res.ok) { setState("sent"); setBody("") } else setState("idle")
    } catch {
      setState("idle")
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? "inline-flex items-center gap-1.5 rounded-lg border border-[#E5EBF0] bg-white px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:border-[#2D7A5F] hover:text-[#2D7A5F]"}
      >
        <LifeBuoy size={13} /> {t("getHelp")}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-[#E5EBF0] bg-white p-4">
          <p className="mb-2 text-xs font-semibold text-[#2B3441]">{t("helpTitle")}</p>
          {state === "sent" ? (
            <p className="flex items-center gap-2 text-xs font-medium text-[#2D7A5F]">
              <CheckCircle2 size={14} /> {t("helpSent")}
            </p>
          ) : (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("helpPlaceholder")}
                rows={3}
                className="mb-2 w-full resize-none rounded-lg border border-[#E5EBF0] bg-white px-3 py-2 text-sm text-[#2B3441] focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={send}
                  disabled={state === "sending" || !body.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D7A5F] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#235f49] disabled:opacity-50"
                >
                  {state === "sending" ? <Loader2 size={12} className="animate-spin" /> : null} {t("helpSend")}
                </button>
                <Link href={side === "client" ? "/support" : "/provider/support"} className="text-xs text-[#6B7280] underline hover:text-[#2B3441]">
                  {t("helpOpenFull")}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
