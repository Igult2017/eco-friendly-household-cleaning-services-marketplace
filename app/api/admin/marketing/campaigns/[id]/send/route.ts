import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { emailCampaigns } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"

// Send a campaign, now or at a chosen time.
//
// Pass { scheduledAt: "<ISO date>" } to send later: the campaign is parked as "scheduled" and the
// 5-minutely sweep (lib/inngest/functions/marketingSchedule.ts) queues it when the time comes.
// With no date it goes immediately, as before. The scheduled_at column existed long before this
// and was never read, so a campaign set for later silently never left.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const [c] = await db.select({ status: emailCampaigns.status }).from(emailCampaigns).where(eq(emailCampaigns.id, id))
  if (!c) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  // "scheduled" is included so double-clicking Send can't queue the same campaign twice — it was
  // missing from this guard before, and the send function only stops a REPEAT once it is already
  // sending, which is a narrow window rather than no window.
  if (c.status === "scheduled" || c.status === "sending" || c.status === "completed") {
    return NextResponse.json({ error: `Campaign already ${c.status}` }, { status: 422 })
  }

  const body = await req.json().catch(() => ({}))
  const raw = (body as { scheduledAt?: unknown }).scheduledAt
  let when: Date | null = null
  if (typeof raw === "string" && raw.trim()) {
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "scheduledAt is not a valid date" }, { status: 400 })
    }
    // A time in the past means "now" rather than an error — clock skew between the admin's browser
    // and the server shouldn't reject a send the admin plainly intended to happen immediately.
    if (parsed.getTime() > Date.now()) when = parsed
  }

  if (when) {
    await db.update(emailCampaigns)
      .set({ status: "scheduled", scheduledAt: when, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
    return NextResponse.json({ success: true, scheduledAt: when.toISOString() })
  }

  await db.update(emailCampaigns)
    .set({ status: "scheduled", scheduledAt: null, updatedAt: new Date() })
    .where(eq(emailCampaigns.id, id))
  try {
    await inngest.send({ name: "marketing/campaign.send", data: { campaignId: id } })
  } catch (e) {
    await db.update(emailCampaigns).set({ status: "failed" }).where(eq(emailCampaigns.id, id))
    return NextResponse.json({ error: `Failed to enqueue: ${(e as Error).message}` }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
