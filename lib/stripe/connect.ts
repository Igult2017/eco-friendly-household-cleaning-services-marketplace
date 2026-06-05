import { stripe } from "./client"

/** Create a Stripe Connect Express account for a new provider */
export async function createConnectAccount(params: {
  email: string
  country: string // ISO 3166-1 alpha-2 e.g. "DE"
}) {
  return stripe.accounts.create({
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
  })
}

/** Generate a Stripe Connect onboarding link */
export async function createAccountLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}) {
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  })
}

/** Generate a Stripe Connect dashboard login link */
export async function createLoginLink(accountId: string) {
  return stripe.accounts.createLoginLink(accountId)
}
