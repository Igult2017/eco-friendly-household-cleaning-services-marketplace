import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import {
  providers, users, bookings, bids, reviews, customerReviews,
  carbonOffsetContributions, providerIdentityVerifications, recurringSchedules,
} from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { isUuid } from "@/lib/utils/uuid"
import { eraseUserData } from "@/lib/admin/eraseUser"
import { logError } from "@/lib/utils/logError"

/**
 * Hard-delete a cleaner profile + its account. Built for removing test / clutter profiles from
 * production. Cascade FKs (services, availability, blackout dates, eco certs) drop automatically;
 * the non-cascade children that can exist without a booking (bids, identity verifications, recurring
 * schedules) are cleared first. BLOCKED if the cleaner has any bookings — those must be suspended,
 * not deleted, to preserve financial/audit records. Admin accounts (incl. your own) can't be deleted.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin()
    if (guard instanceof NextResponse) return guard

    const { id: providerId } = await params
    if (!isUuid(providerId)) return NextResponse.json({ error: "Invalid provider id" }, { status: 400 })

    const [provider] = await db
      .select({ id: providers.id, userId: providers.userId, businessName: providers.businessName })
      .from(providers)
      .where(eq(providers.id, providerId))
    if (!provider) return NextResponse.json({ error: "Cleaner not found" }, { status: 404 })

    // Never delete your own — or any admin's — account from here.
    if (provider.userId === guard.adminId) {
      return NextResponse.json({ error: "You can't delete your own account here." }, { status: 409 })
    }
    const [targetUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, provider.userId))
    if (targetUser?.role === "admin") {
      return NextResponse.json({ error: "Admin accounts can't be deleted here." }, { status: 409 })
    }

    // Preserve financial/audit history: a cleaner with bookings must be suspended, not deleted.
    const [bk] = await db.select({ n: count() }).from(bookings).where(eq(bookings.providerId, providerId))
    if (Number(bk?.n ?? 0) > 0) {
      return NextResponse.json(
        { error: "This cleaner has bookings — suspend the account instead of deleting it, to preserve records." },
        { status: 409 },
      )
    }

    // Clear non-cascade children. The booking-dependent ones are already empty (guard above); included
    // for safety so the provider row can never hit a foreign-key constraint.
    await db.delete(bids).where(eq(bids.providerId, providerId))
    await db.delete(providerIdentityVerifications).where(eq(providerIdentityVerifications.providerId, providerId))
    await db.delete(recurringSchedules).where(eq(recurringSchedules.providerId, providerId))
    await db.delete(reviews).where(eq(reviews.providerId, providerId))
    await db.delete(customerReviews).where(eq(customerReviews.providerId, providerId))
    await db.delete(carbonOffsetContributions).where(eq(carbonOffsetContributions.providerId, providerId))

    // Provider row — cascades eco certs, services, availability, blackout dates. Any non-cascade child
    // we didn't anticipate surfaces here as a foreign-key error → return a clear 409, not a 500.
    try {
      await db.delete(providers).where(eq(providers.id, providerId))
    } catch (e) {
      if ((e as { code?: string })?.code === "23503") {
        return NextResponse.json({ error: "This cleaner still has linked records and can't be auto-deleted. Suspend the account instead." }, { status: 409 })
      }
      throw e
    }

    // Remove the underlying account too (these are full accounts): revoke login + erase PII. Best-effort
    // so the profile is still deleted even if Clerk / the erase step hiccups.
    try {
      const clerk = await clerkClient()
      await clerk.users.deleteUser(provider.userId)
    } catch (e) {
      console.warn("[admin/providers DELETE] Clerk delete failed:", e instanceof Error ? e.message : e)
    }
    try {
      await eraseUserData(provider.userId)
    } catch (e) {
      console.warn("[admin/providers DELETE] eraseUserData failed:", e instanceof Error ? e.message : e)
    }

    return NextResponse.json({ success: true, deleted: provider.businessName })
  } catch (err) {
    console.error("[admin/providers/[id] DELETE]", err)
    void logError({ message: "[admin/providers/[id] DELETE]", error: err, route: "/api/admin/providers/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
