// One-off: applies the new payout-onboarding settings (drop the "card_payments" capability that
// was forcing a business-website step, switch bank payouts from daily to weekly) to every cleaner
// who already has a Stripe Connect account. New accounts get these settings automatically at
// creation (lib/stripe/connect.ts); this script only needs to run once for pre-existing accounts.
//
// Deliberately dependency-free (raw fetch against Stripe's REST API, no `stripe` package import):
// this app's production container is a Next.js standalone build, and file-tracing only keeps
// node_modules entries actually referenced by the compiled server bundle — `stripe`/`postgres`
// aren't requirable as raw packages there, so a script meant to run inside that container can't
// import them. Run with STRIPE_SECRET_KEY already in the environment (e.g. inside the running app
// container, where Coolify has already set it):
//   node scripts/migrate-connect-payout-settings.mjs acct_xxx acct_yyy ...
const accountIds = process.argv.slice(2)
const key = process.env.STRIPE_SECRET_KEY
if (!key) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1) }
if (accountIds.length === 0) { console.error("Usage: node migrate-connect-payout-settings.mjs <acct_id> [acct_id...]"); process.exit(1) }

async function updateAccount(accountId, body) {
  const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
  return data
}

async function main() {
  for (const accountId of accountIds) {
    // Always safe regardless of account state. Stripe requires an explicit weekly_anchor day
    // once interval is "weekly" — Monday matches the ledger-summary cron's own schedule.
    try {
      await updateAccount(accountId, "settings[payouts][schedule][interval]=weekly&settings[payouts][schedule][weekly_anchor]=monday")
      console.log(`${accountId}: payout schedule -> weekly`)
    } catch (e) {
      console.error(`${accountId}: FAILED to set weekly schedule —`, e.message)
    }

    // Isolated in its own try/catch — an already-active account may reject un-requesting a
    // capability it already cleared; that must never block the schedule change above or the next
    // account in the loop. link_payments rides along with card_payments on some accounts and Stripe
    // refuses to drop one without the other.
    try {
      await updateAccount(accountId, "capabilities[card_payments][requested]=false&capabilities[link_payments][requested]=false")
      console.log(`${accountId}: card_payments/link_payments capabilities -> not requested`)
    } catch (e) {
      console.error(`${accountId}: could not drop card_payments (non-fatal) —`, e.message)
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
