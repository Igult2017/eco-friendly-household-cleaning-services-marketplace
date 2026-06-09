import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const approveSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "unsuspend"]),
  reason: z.string().max(500).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: providerId } = await params
  const body = await req.json()
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
    notifBody = "You can now receive bookings on DORIX. Complete your profile to get started."
  } else if (action === "reject") {
    updates.isApproved = false
    notifTitle = "Application update"
    notifBody = "Your provider application was not approved at this time."
  } else if (action === "suspend") {
    updates.isSuspended = true
    notifTitle = "Account suspended"
    notifBody = "Your DORIX provider account has been temporarily suspended."
  } else if (action === "unsuspend") {
    updates.isSuspended = false
    notifTitle = "Account reinstated"
    notifBody = "Your DORIX provider account has been reinstated."
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
    link: "/dashboard",
  })

  return NextResponse.json({ success: true, action })
}
