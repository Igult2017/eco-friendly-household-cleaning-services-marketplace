import { stripe } from "./client"
import { getPayoutSchedule } from "@/lib/platform/settings"

/**
 * How many days after a job is paid for the cleaner's money reaches their bank.
 *
 * These ARE the payout policy — there is no calendar day involved (see createConnectAccount).
 *  - weekly  → 7 days, which is also Stripe's minimum hold for Germany, so this is as fast as the
 *              platform is allowed to pay.
 *  - monthly → 28 days = that same 7-day hold plus three more weeks. Four weeks, never five:
 *              a calendar anchor on the 1st meant a job on the 26th waited ~34 days.
 *
 * 28 is deliberately four weeks rather than a calendar month, so the wait is a fixed, promisable
 * number instead of 28–34 days depending on which month the job happened to fall in.
 */
export const PAYOUT_DELAY_DAYS: Record<"weekly" | "monthly", number> = { weekly: 7, monthly: 28 }
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

// Stripe REFUSES a transfers-only account in the US: "You cannot request the `transfers` capability
// without the `card_payments` capability for accounts in US." Requesting transfers alone there fails
// outright, so a US cleaner could not create an account at all. Across the EU transfers alone is
// accepted and keeps the requirement list shorter, so card_payments is only added where Stripe
// insists on it. Verified live per country (accounts created and deleted):
//   DE FR ES IT NL PL PT IE -> transfers alone accepted, no website asked
//   US                      -> transfers alone REJECTED; with card_payments it creates fine and,
//                              thanks to BUSINESS_PROFILE above, still asks for no website
const CARD_PAYMENTS_REQUIRED = new Set(["US"])

/** Create a Stripe Connect Express account for a new provider.
 * Pass `idempotencyKey` (e.g. per provider id) so a retry after a failed DB write
 * returns the SAME account instead of creating an orphaned duplicate (BUG-008d). */
export async function createConnectAccount(params: {
  email?: string
  country: string // ISO 3166-1 alpha-2 e.g. "DE"
  idempotencyKey?: string
}) {
  // Admin-configurable (see /admin/settings "Default Payout Schedule"), but NOT as a calendar
  // anchor. An anchored schedule makes the cleaner wait twice: Stripe holds each payment for its
  // country minimum (7 days in Germany) and only THEN does the money wait for the next payout day.
  // A job finished on the 26th missed the 1st and was paid ~34 days later — five weeks for someone
  // who cleans houses for a living.
  //
  // `daily` is not "paid every day": it is a ROLLING payout, where each payment leaves exactly
  // delay_days after it clears, with no calendar day to wait for. So the delay alone expresses the
  // whole policy, and the worst case equals the delay instead of delay + up to a month.
  const preference = await getPayoutSchedule()
  const schedule = { interval: "daily" as const, delay_days: PAYOUT_DELAY_DAYS[preference] }
  return stripe.accounts.create(
    {
      type: "express",
      country: params.country,
      email: params.email,
      // "transfers" is all the account actually needs — it only ever RECEIVES the destination-charge
      // split and pays it out to a bank; the client's card is always charged on the platform's own
      // account (see app/api/payments/intent/route.ts). card_payments is added ONLY where Stripe
      // rejects transfers-on-its-own (see CARD_PAYMENTS_REQUIRED) — it is not what drives the website
      // question, contrary to what this comment used to claim; BUSINESS_PROFILE is what settles that.
      capabilities: CARD_PAYMENTS_REQUIRED.has(params.country.toUpperCase())
        ? { transfers: { requested: true }, card_payments: { requested: true } }
        : { transfers: { requested: true } },
      business_type: "individual",
      // Tells Stripe what the cleaner sells, which is what stops it demanding a business website.
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

/**
 * The currency a connected account should actually be paid in.
 *
 * Referral payouts used to send every transfer in euros, which is wrong for a US payee — the rest of
 * the platform is careful about this (bookings are charged in the cleaner's own currency, and the
 * weekly payout uses whatever the booking was captured in). Asking Stripe for the account's own
 * default currency covers every country without this code keeping its own country-to-currency list.
 *
 * Falls back to euro if Stripe can't be reached, which is the pre-existing behaviour and the right
 * default for the majority market — a payout attempted in the wrong currency fails loudly at
 * Stripe rather than silently sending the wrong amount.
 */
export async function getAccountPayoutCurrency(accountId: string): Promise<string> {
  try {
    const account = await stripe.accounts.retrieve(accountId)
    return account.default_currency ?? "eur"
  } catch {
    return "eur"
  }
}

/**
 * When THIS cleaner's money actually reaches their bank, in words, for the weekly earnings email.
 *
 * Asks Stripe about the cleaner's own account rather than reading the admin setting, because the
 * two drift apart by design: the setting is applied once, when the account is created, so changing
 * it later leaves existing cleaners where they were. Three accounts on this platform are already on
 * a different schedule from the current setting — so quoting the setting would tell some cleaners
 * the wrong payday.
 *
 * Returns null when Stripe can't be reached, and the caller then says nothing rather than guessing:
 * a wrong payday in writing is worse than no payday in writing.
 */
export async function describePayoutSchedule(
  accountId: string,
): Promise<{ interval: "weekly" | "monthly" | "daily" | "manual"; delayDays: number | null } | null> {
  try {
    const account = await stripe.accounts.retrieve(accountId)
    const s = account.settings?.payouts?.schedule
    if (!s?.interval) return null
    return {
      interval: s.interval as "weekly" | "monthly" | "daily" | "manual",
      delayDays: typeof s.delay_days === "number" ? s.delay_days : null,
    }
  } catch {
    return null
  }
}
