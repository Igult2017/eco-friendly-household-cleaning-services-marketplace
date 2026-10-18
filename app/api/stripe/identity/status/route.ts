import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { refreshIdentityStatus } from "@/lib/stripe/identityStatus"
import { logError } from "@/lib/utils/logError"

// Asks Stripe what the signed-in cleaner's identity check says and writes the answer down, so the
// page is right the moment they close the pop-up instead of waiting on the webhook. Mirrors
// app/api/stripe/connect/status/route.ts, which does the same job for payout setup.
//
// This is also the cleaner's own escape hatch: if the webhook never lands, pressing on with the
// job calls this and releases the hold, rather than them losing the work to the deadline sweep.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (!provider) return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })

    const result = await refreshIdentityStatus(provider.id)
    return NextResponse.json({
      status: result.status,
      verified: result.status === "verified",
      releasedBookings: result.releasedBookingIds.length,
      // False when Stripe could not be reached — the page should keep showing the prompt rather
      // than claiming anything changed.
      live: result.live,
    })
  } catch (err) {
    console.error("[stripe/identity/status POST]", err)
    void logError({
      message: "[stripe/identity/status POST]",
      error: err,
      route: "/api/stripe/identity/status",
      severity: "error",
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
