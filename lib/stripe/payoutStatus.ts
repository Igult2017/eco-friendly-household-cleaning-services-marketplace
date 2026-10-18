import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getConnectAccountStatus } from "./connect"
import { logError } from "@/lib/utils/logError"

export type PayoutStatus = "active" | "pending" | "incomplete" | null

/** How long to wait on Stripe before falling back to the stored value. The cleaner's page must
 * render either way — a slow Stripe is not a reason to show nothing. */
const LOOKUP_TIMEOUT_MS = 4000

/**
 * The cleaner's payout state, corrected against Stripe when our stored copy is in doubt.
 *
 * `providers.stripe_account_status` is only ever written by the account.updated webhook
 * (app/api/webhooks/stripe/route.ts) or by the refresh fired when the cleaner closes the embedded
 * form (components/provider/StripeConnectEmbed.tsx). Miss both — webhook undelivered, or the tab
 * closed early — and the stored copy stays wrong forever, because nothing else ever re-asks.
 *
 * That is not just a stale card: the same value gates real money in lib/bookings/create.ts,
 * app/api/bookings/[id]/pay and app/api/payments/intent, so a cleaner who DID finish with Stripe
 * becomes silently unbookable and unpayable with nothing on screen explaining why.
 *
 * Re-asking on render self-heals that. It costs one Stripe call, and only for a cleaner who is not
 * yet active — once they are, this returns immediately and never calls out again.
 */
export async function resolvePayoutStatus(
  providerId: string,
  stripeAccountId: string | null,
  stored: PayoutStatus,
): Promise<PayoutStatus> {
  // Already active, or no Stripe account to ask about — nothing to verify.
  if (stored === "active" || !stripeAccountId) return stored

  try {
    const fresh = await withTimeout(getConnectAccountStatus(stripeAccountId), LOOKUP_TIMEOUT_MS)
    if (fresh !== stored) {
      await db.update(providers).set({ stripeAccountStatus: fresh }).where(eq(providers.id, providerId))
    }
    return fresh
  } catch (err) {
    // Deliberately not fatal. Showing the cleaner their last-known state beats failing the page.
    void logError({
      message: "[payoutStatus] could not refresh Connect status from Stripe",
      error: err,
      severity: "warning",
      context: { providerId, stripeAccountId, stored },
    })
    return stored
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Stripe lookup exceeded ${ms}ms`)), ms),
    ),
  ])
}
