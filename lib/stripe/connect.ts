import { stripe } from "./client"
import { getPayoutSchedule } from "@/lib/platform/settings"
// A cleaner never takes a card payment — the client is charged on the platform account and the money
// is transferred on — so they have no business website and must never be asked for one. Stripe only
// demands business_profile.url when it has NO other idea what the account sells: telling it the
// industry + what the service is satisfies that instead, with no website involved.
//
// Verified directly against live Stripe (three accounts created and deleted to compare):
//   no business_profile at all            -> business_profile.url REQUIRED
//   mcc + product_description, no url     -> NOT required   <- what we do
//   mcc + product_description + url       -> not required, but pins a URL on the cleaner's account
// Deliberately no `url` here: setting one made Stripe drop product_description and show the cleaner a
// "Your website" box pre-filled with the marketplace address, which isn't their website.
const BUSINESS_PROFILE = {
  mcc: "7349", // Cleaning and Maintenance, Janitorial Services
  product_description: "Eco-friendly home and office cleaning services provided through the DORIXE marketplace",
} as const

/** Create a Stripe Connect Express account for a new provider.
 * Pass `idempotencyKey` (e.g. per provider id) so a retry after a failed DB write
 * returns the SAME account instead of creating an orphaned duplicate (BUG-008d). */
export async function createConnectAccount(params: {
  email?: string
  country: string // ISO 3166-1 alpha-2 e.g. "DE"
  idempotencyKey?: string
}) {
  // Admin-configurable (see /admin/settings "Default Payout Schedule") — Stripe only supports
  // "weekly" and "monthly" for a payout interval, not "biweekly".
  const interval = await getPayoutSchedule()
  const schedule =
    interval === "monthly"
      ? { interval: "monthly" as const, monthly_anchor: 1 }
      // Stripe requires an explicit day when interval is "weekly" — Monday matches the existing
      // ledger-summary cron (lib/inngest/functions/payouts.ts runs 0 2 * * 1, also Monday).
      : { interval: "weekly" as const, weekly_anchor: "monday" as const }
  return stripe.accounts.create(
    {
      type: "express",
      country: params.country,
      email: params.email,
      // Only "transfers" — the connected account only ever RECEIVES the destination-charge split
      // and pays it out to a bank; it never accepts a card payment directly (the customer's card is
      // always charged on the platform's own account, see app/api/payments/intent/route.ts). Asking
      // for "card_payments" anyway made Stripe treat cleaners as online merchants and demand a
      // business website during onboarding — dropping it removes that ask entirely.
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      // Includes the website URL — dropping the card_payments capability alone does NOT stop Stripe
      // asking for one (proven on live accounts), so we set it rather than leaving it to the cleaner.
      business_profile: BUSINESS_PROFILE,
      settings: {
        payouts: { schedule },
      },
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  )
}

/** Repair an account created before we described the service to Stripe. Those accounts have no
 * industry code, so Stripe falls back to demanding a business website the cleaner doesn't have and
 * onboarding can never be finished. Called every time payout setup is opened, so a stuck cleaner
 * fixes themselves just by clicking the button again — no manual Stripe surgery.
 *
 * Keyed off the industry code, not the website: a missing mcc is what marks an account as predating
 * this. Never sets a url, and never clears one a cleaner deliberately entered themselves. */
export async function ensureBusinessProfile(accountId: string): Promise<void> {
  try {
    const account = await stripe.accounts.retrieve(accountId)
    if (account.business_profile?.mcc) return
    await stripe.accounts.update(accountId, {
      business_profile: {
        mcc: BUSINESS_PROFILE.mcc,
        product_description: account.business_profile?.product_description ?? BUSINESS_PROFILE.product_description,
      },
    })
  } catch (err) {
    // Never block opening the onboarding form over this — worst case the cleaner sees the same
    // website question as before, which is the behaviour we're trying to remove, not a new failure.
    console.warn(`[stripe/connect] could not backfill business profile for ${accountId}:`, err)
  }
}

/** Create an Account Session client secret for the embedded Account Onboarding component
 * (@stripe/connect-js / @stripe/react-connect-js). The cleaner never leaves the app — the
 * onboarding form renders inline, themed to match. Stripe still owns all KYC/identity
 * verification and bank-account collection; we only render the component. */
export async function createAccountSession(accountId: string) {
  const session = await stripe.accountSessions.create({
    account: accountId,
    components: {
      account_onboarding: {
        enabled: true,
        features: { external_account_collection: true },
      },
    },
  })
  return session.client_secret
}

/** Retrieve the live Connect account status, mapped the same way as the account.updated webhook
 * (so the value is consistent). Used on the onboarding-return to flip the DB to "active" immediately,
 * without depending on the webhook being configured in the Stripe Dashboard. */
export async function getConnectAccountStatus(accountId: string): Promise<"active" | "pending" | "incomplete"> {
  const account = await stripe.accounts.retrieve(accountId)
  // payouts_enabled, not charges_enabled — the account only has the "transfers" capability, never
  // "card_payments", so charges_enabled would never turn true and every cleaner would be stuck on
  // "pending" forever. payouts_enabled is Stripe's own signal for "this account can actually be paid".
  return account.payouts_enabled ? "active" : account.details_submitted ? "pending" : "incomplete"
}
