import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifyUnsubToken } from "@/lib/marketing/unsubscribe"

async function optOut(token: string | null): Promise<boolean> {
  const userId = verifyUnsubToken(token ?? "")
  if (!userId) return false
  await db.update(users).set({ marketingConsent: false, updatedAt: new Date() }).where(eq(users.id, userId))
  return true
}

// GET does NOT mutate (email link scanners / prefetchers issue GETs and would otherwise
// auto-unsubscribe people). It just forwards to the confirmation page, which POSTs to opt out.
// Use the public base URL, NOT req.url — inside the container req.url is 0.0.0.0:3000.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? ""
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://xn--dorix-fsa.com"
  return NextResponse.redirect(`${base}/unsubscribe?token=${encodeURIComponent(token)}`)
}

// POST opts out — used by the confirmation button AND by RFC 8058 one-click (List-Unsubscribe-Post).
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token")
  const ok = await optOut(token)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
