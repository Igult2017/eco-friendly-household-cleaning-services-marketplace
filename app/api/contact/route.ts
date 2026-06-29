import { NextResponse } from "next/server"
import { z } from "zod"
import { headers } from "next/headers"
import { resend, FROM } from "@/lib/resend/client"
import { createRateLimiter, safeLimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
})

const contactRatelimit = createRateLimiter({ tokens: 5, windowSeconds: 3600, prefix: "ratelimit:contact" })

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function POST(req: Request) {
  try {
    const hdrs = await headers()
    const ip = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0].trim() ?? "anon"
    const { success } = await safeLimit(contactRatelimit, ip)
    if (!success) return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 })

    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    const { name, email, subject, message } = parsed.data

    const to = process.env.ADMIN_EMAIL
    if (!to) {
      console.warn("[contact] ADMIN_EMAIL not set — message dropped")
      return NextResponse.json({ success: true })
    }

    await resend.emails.send({
      from: FROM,
      to,
      subject: `[Support] ${subject.slice(0, 160)}`,
      html: `<p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p><p><strong>Subject:</strong> ${esc(subject)}</p><hr/><p>${esc(message).replace(/\n/g, "<br>")}</p>`,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[contact POST]", err)
    void logError({ message: "[contact POST]", error: err, route: "/api/contact", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
