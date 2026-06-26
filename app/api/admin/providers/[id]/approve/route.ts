import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { sendProviderApprovedEmail } from "@/lib/resend/providerApproved"

const approveSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "unsuspend"]),
  reason: z.string().max(500).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id: providerId } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { action } = parsed.data

    const [provider] = await db.select({ id: providers.id, userId: providers.userId }).from(providers).where(eq(providers.id, providerId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const updates: Record<string, boolean> = {}
    let notifTitle = ""
    let notifBody = ""

    if (action === "approve") {
      updates.isApproved = true
      updates.isSuspended = false
      notifTitle = "Your application was approved!"
      notifBody = "You can now receive bookings on DORIXÉ. Complete your profile to get started."
    } else if (action === "reject") {
      updates.isApproved = false
      notifTitle = "Application update"
      notifBody = "Your provider application was not approved at this time."
    } else if (action === "suspend") {
      updates.isSuspended = true
      notifTitle = "Account suspended"
      notifBody = "Your DORIXÉ provider account has been temporarily suspended."
    } else if (action === "unsuspend") {
      updates.isSuspended = false
      notifTitle = "Account reinstated"
      notifBody = "Your DORIXÉ provider account has been reinstated."
    }

    await db.update(providers).set(updates).where(eq(providers.id, providerId))

    const notifType = {
      approve: "provider_approved",
      reject: "provider_rejected",
      suspend: "provider_suspended",
      unsuspend: "provider_unsuspended",
    }[action] as "provider_approved" | "provider_rejected" | "provider_suspended" | "provider_unsuspended"

    await db.insert(notifications).values({
      userId: provider.userId,
      type: notifType,
      title: notifTitle,
      body: notifBody,
      link: action === "approve" ? "/provider/dashboard" : "/provider/profile",
    })

    // Congratulations email on approval (best-effort — never block the admin action).
    if (action === "approve") {
      try { await sendProviderApprovedEmail(provider.userId) } catch (e) { console.warn("[admin/providers approve] email failed:", e) }
    }

    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error("[admin/providers/[id]/approve POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
