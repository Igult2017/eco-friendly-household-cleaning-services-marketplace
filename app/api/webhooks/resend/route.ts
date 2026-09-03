import { NextResponse } from "next/server"
import { Webhook } from "svix"
import { applyEmailEvent, isHandledEvent } from "@/lib/marketing/feedback"
import { logError } from "@/lib/utils/logError"

// Resend tells us what happened to each marketing email AFTER we hand it over: delivered, opened,
// clicked, bounced, reported as spam. Without this endpoint email_sends could only ever say "sent"
// or "failed", so there was no way to know whether any campaign actually worked.
//
// Signed with Standard Webhooks (svix), the same scheme the Clerk webhook uses. Unsigned or
// wrongly-signed requests are rejected: this endpoint can switch a user's marketing consent off,
// so anyone able to forge a call could silently unsubscribe the whole user base.
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Refuse rather than trust an unverified body. Loud on purpose — a missing secret means every
    // event is being dropped, which is exactly the kind of silent gap this whole change fixes.
    await logError({
      message: "RESEND_WEBHOOK_SECRET is not set — email feedback events are being rejected",
      route: "/api/webhooks/resend",
      method: "POST",
      statusCode: 500,
      severity: "critical",
    })
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const body = await req.text()
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  }

  let event: { type?: string; data?: Record<string, unknown> }
  try {
    event = new Webhook(secret).verify(body, headers) as typeof event
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const type = event.type ?? ""
  if (!isHandledEvent(type)) {
    // Events we don't act on (email.sent, email.delivery_delayed…) are fine — acknowledge so Resend
    // doesn't retry them forever.
    return NextResponse.json({ ok: true, ignored: type })
  }

  const data = event.data ?? {}
  const messageId = typeof data.email_id === "string" ? data.email_id : null
  if (!messageId) return NextResponse.json({ ok: true, ignored: "no_email_id" })

  // Resend reports a bounce's severity in a nested object. Read it defensively — only an explicitly
  // permanent bounce is allowed to unsubscribe anyone (see applyEmailEvent).
  const bounce = data.bounce as { type?: string } | undefined

  try {
    const result = await applyEmailEvent({ type, messageId, bounceType: bounce?.type })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    await logError({
      message: `Failed to record Resend event ${type}`,
      error: e,
      route: "/api/webhooks/resend",
      method: "POST",
      statusCode: 500,
      context: { type, messageId },
    })
    // 500 tells Resend to retry — better than losing the event.
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 })
  }
}
