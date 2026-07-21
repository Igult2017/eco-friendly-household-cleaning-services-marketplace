import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createConnectAccount, createAccountSession } from "@/lib/stripe/connect"
import { logError } from "@/lib/utils/logError"

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [[provider], [user]] = await Promise.all([
      db.select({ id: providers.id, stripeAccountId: providers.stripeAccountId, country: providers.country })
        .from(providers).where(eq(providers.userId, userId)),
      db.select({ email: users.email }).from(users).where(eq(users.id, userId)),
    ])

    if (!provider) {
      return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })
    }

    let stripeAccountId = provider.stripeAccountId

    if (!stripeAccountId) {
      // BUG-008d: idempotency-key the account creation per provider so a retry after a
      // failed DB write returns the same account rather than orphaning a duplicate.
      const account = await createConnectAccount({
        email: user?.email ?? undefined,
        country: provider.country,
        idempotencyKey: `connect-acct-${provider.id}`,
      })
      stripeAccountId = account.id

      try {
        await db
          .update(providers)
          .set({ stripeAccountId, stripeAccountStatus: "pending" })
          .where(eq(providers.id, provider.id))
      } catch (dbErr) {
        // The Stripe account exists but we failed to record it. Log the id so it's
        // reconcilable; the idempotency key makes a retry reuse this same account.
        console.error(`[stripe/connect/account] account ${account.id} created for provider ${provider.id} but DB update failed:`, dbErr)
        throw dbErr
      }
    }

    const clientSecret = await createAccountSession(stripeAccountId)
    return NextResponse.json({ clientSecret })
  } catch (err) {
    console.error("[stripe/connect/account POST]", err)
    void logError({ message: "[stripe/connect/account POST]", error: err, route: "/api/stripe/connect/account", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
