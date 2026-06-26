import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"

// Approval is automatic (a completed cleaner profile is approved). Admins do NOT approve/reject —
// they can only suspend (ban) or reinstate a cleaner account.
const approveSchema = z.object({
  action: z.enum(["suspend", "unsuspend"]),
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

    const isSuspend = action === "suspend"
    await db
      .update(providers)
      .set({ isSuspended: isSuspend })
      .where(eq(providers.id, providerId))

    await db.insert(notifications).values({
      userId: provider.userId,
      type: isSuspend ? "provider_suspended" : "provider_unsuspended",
      title: isSuspend ? "Account suspended" : "Account reinstated",
      body: isSuspend
        ? "Your DORIXÉ cleaner account has been suspended by an administrator. Please contact support."
        : "Your DORIXÉ cleaner account has been reinstated.",
      link: "/provider/profile",
    })

    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error("[admin/providers/[id]/approve POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
