import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { emailCampaigns } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"

// Trigger a campaign send. The Inngest fn does the fan-out (per-user AI copy + send).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const [c] = await db.select({ status: emailCampaigns.status }).from(emailCampaigns).where(eq(emailCampaigns.id, id))
  if (!c) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  if (c.status === "sending" || c.status === "completed") {
    return NextResponse.json({ error: `Campaign already ${c.status}` }, { status: 422 })
  }

  await db.update(emailCampaigns).set({ status: "scheduled", updatedAt: new Date() }).where(eq(emailCampaigns.id, id))
  try {
    await inngest.send({ name: "marketing/campaign.send", data: { campaignId: id } })
  } catch (e) {
    await db.update(emailCampaigns).set({ status: "failed" }).where(eq(emailCampaigns.id, id))
    return NextResponse.json({ error: `Failed to enqueue: ${(e as Error).message}` }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
