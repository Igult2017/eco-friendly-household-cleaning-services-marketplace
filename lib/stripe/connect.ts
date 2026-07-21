import { stripe } from "./client"

/** Create a Stripe Connect Express account for a new provider.
 * Pass `idempotencyKey` (e.g. per provider id) so a retry after a failed DB write
 * returns the SAME account instead of creating an orphaned duplicate (BUG-008d). */
export async function createConnectAccount(params: {
  email?: string
  country: string // ISO 3166-1 alpha-2 e.g. "DE"
  idempotencyKey?: string
}) {
  return stripe.accounts.create(
    {
      type: "express",
      country: params.country,
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      settings: {
        payouts: {
          schedule: { interval: "weekly", weekly_anchor: "monday" },
        },
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
  return account.charges_enabled ? "active" : account.details_submitted ? "pending" : "incomplete"
}
