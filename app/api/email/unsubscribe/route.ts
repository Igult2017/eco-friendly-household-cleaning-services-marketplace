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

// Link click → opt out, then show a confirmation page.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")
  const ok = await optOut(token)
  return NextResponse.redirect(new URL(`/unsubscribe?ok=${ok ? 1 : 0}`, req.url))
}

// RFC 8058 one-click (email clients POST here automatically) → opt out, 200.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token")
  await optOut(token)
  return new NextResponse(null, { status: 200 })
}
