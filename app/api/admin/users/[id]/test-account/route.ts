import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { logError } from "@/lib/utils/logError"

/**
 * Marks an account as a test account, or clears the mark.
 *
 * A flagged account may bid on and be booked for its own jobs — the three job-board checks (same
 * person, same internet connection, distance) step aside for it. That exists because the owner
 * could not otherwise test the platform without paying a real person to play the other side.
 *
 * Admin-only, off by default, and nothing else is relaxed: payment, identity and payout rules work
 * exactly as they do for a real cleaner, which is the point — those are what is being tested.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const body = await req.json().catch(() => ({}) as { isTestAccount?: unknown })
    const isTestAccount = (body as { isTestAccount?: unknown }).isTestAccount

    if (typeof isTestAccount !== "boolean") {
      return NextResponse.json({ error: "isTestAccount must be true or false" }, { status: 400 })
    }

    const [updated] = await db
      .update(users)
      .set({ isTestAccount })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, isTestAccount: users.isTestAccount })

    if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Recorded deliberately: an account that can sidestep anti-fraud checks should leave a trail of
    // who granted it and when, not just quietly start behaving differently.
    void logError({
      message: `[admin] ${updated.email} ${isTestAccount ? "marked as" : "cleared as"} a test account`,
      severity: "info",
      route: "/api/admin/users/[id]/test-account",
      userId: guard.adminId,
      context: { targetUserId: id, isTestAccount },
    })

    return NextResponse.json({ success: true, isTestAccount: updated.isTestAccount })
  } catch (err) {
    console.error("[admin/users/[id]/test-account PATCH]", err)
    void logError({
      message: "[admin/users/[id]/test-account PATCH]",
      error: err,
      route: "/api/admin/users/[id]/test-account",
      severity: "error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
