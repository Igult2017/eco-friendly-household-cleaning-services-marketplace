import { stripe } from "./client"
import { getPayoutSchedule } from "@/lib/platform/settings"

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
      // Belt-and-suspenders alongside dropping card_payments: a service-industry MCC + a plain
      // description mean nothing should ever prompt for a website, even on an edge case.
      business_profile: {
        mcc: "7349", // Cleaning and Maintenance, Janitorial Services
        product_description: "Eco-friendly home and office cleaning services",
      },
      settings: {
        payouts: { schedule },
      },
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined,
  )
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
