import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getConnectAccountStatus } from "@/lib/stripe/connect"
import { logError } from "@/lib/utils/logError"

// Live-refreshes the caller's Connect status immediately after they exit the embedded
// onboarding component, so the UI reflects "connected" right away instead of waiting on the
// account.updated webhook (still the source of truth as a backstop).
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db
      .select({ id: providers.id, stripeAccountId: providers.stripeAccountId, stripeAccountStatus: providers.stripeAccountStatus })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (!provider) return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })
    if (!provider.stripeAccountId) return NextResponse.json({ status: null })

    const status = await getConnectAccountStatus(provider.stripeAccountId)
    if (status !== provider.stripeAccountStatus) {
      await db.update(providers).set({ stripeAccountStatus: status }).where(eq(providers.id, provider.id))
    }
    return NextResponse.json({ status })
  } catch (err) {
    console.error("[stripe/connect/status POST]", err)
    void logError({ message: "[stripe/connect/status POST]", error: err, route: "/api/stripe/connect/status", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
