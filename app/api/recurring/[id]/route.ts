import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { recurringSchedules } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

const patchSchema = z.object({
  status: z.enum(["paused", "cancelled"]),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: scheduleId } = await params

    const body = await req.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 })
    }

    const { status } = parsed.data

    const [schedule] = await db
      .select({ id: recurringSchedules.id })
      .from(recurringSchedules)
      .where(and(eq(recurringSchedules.id, scheduleId), eq(recurringSchedules.customerId, userId)))

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    await db
      .update(recurringSchedules)
      .set({
        status,
        nextBookingAt: status === "cancelled" ? null : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(recurringSchedules.id, scheduleId), eq(recurringSchedules.customerId, userId))) // L4: scope to owner

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[recurring/[id] PATCH]", err)
    void logError({ message: "[recurring/[id] PATCH]", error: err, route: "/api/recurring/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
