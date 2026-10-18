// Applies the current payout settings to cleaners who ALREADY have a Stripe Connect account: a
// rolling payout a fixed number of days after each job, and dropping the "card_payments" capability
// that was forcing a business-website step. New accounts get these at creation
// (lib/stripe/connect.ts) — this script exists because that is applied ONCE, so changing the admin
// setting never moves a cleaner who is already set up.
//
// It previously set an anchored weekly schedule. That was replaced because an anchor makes the
// cleaner wait twice — Stripe's country hold (7 days in Germany) and then the next payout day — so
// a job finished on the 26th was paid about 34 days later. Days, not weekdays, is the policy now.
//
// Deliberately dependency-free (raw fetch against Stripe's REST API, no `stripe` package import):
// this app's production container is a Next.js standalone build, and file-tracing only keeps
// node_modules entries actually referenced by the compiled server bundle — `stripe`/`postgres`
// aren't requirable as raw packages there, so a script meant to run inside that container can't
// import them. Run with STRIPE_SECRET_KEY already in the environment (e.g. inside the running app
// container, where Coolify has already set it):
//   node scripts/migrate-connect-payout-settings.mjs acct_xxx acct_yyy ...
const args = process.argv.slice(2)
const accountIds = args.filter((a) => !a.startsWith("--"))
// Days after a job is paid for that the money reaches the bank. 7 is Stripe's minimum hold in
// Germany (the fastest allowed); 28 is that hold plus three weeks — four weeks, never five.
const daysArg = args.find((a) => a.startsWith("--days="))
const delayDays = Number(daysArg?.split("=")[1] ?? 28)
const key = process.env.STRIPE_SECRET_KEY
if (!key) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1) }
if (accountIds.length === 0) { console.error("Usage: node migrate-connect-payout-settings.mjs [--days=28] <acct_id> [acct_id...]"); process.exit(1) }
if (!Number.isInteger(delayDays) || delayDays < 2 || delayDays > 30) { console.error(`--days must be a whole number between 2 and 30 (got ${delayDays})`); process.exit(1) }

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

async function getAccount(accountId) {
  const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
  return data
}

async function main() {
  for (const accountId of accountIds) {
    // Rolling payout, no calendar anchor. An anchored weekly/monthly schedule made the cleaner wait
    // twice — Stripe's country hold AND then the next payout day — so a job on the 26th was paid
    // about 34 days later. With "daily" each payment leaves exactly delay_days after it clears, so
    // the worst case equals the delay. Setting delay_days explicitly also stops it silently
    // following a Stripe country default.
    try {
      await updateAccount(
        accountId,
        `settings[payouts][schedule][interval]=daily&settings[payouts][schedule][delay_days]=${delayDays}`,
      )
      // Read it back — the run itself is the proof, rather than trusting that a 200 meant the value
      // was taken verbatim (Stripe can clamp a delay to a country's allowed range).
      const after = await getAccount(accountId)
      const s = after?.settings?.payouts?.schedule ?? {}
      console.log(`${accountId}: payout schedule -> interval=${s.interval} delay_days=${s.delay_days} (asked for ${delayDays})`)
      if (s.delay_days !== delayDays) {
        console.error(`${accountId}: WARNING — Stripe stored ${s.delay_days} days, not the ${delayDays} requested`)
      }
    } catch (e) {
      console.error(`${accountId}: FAILED to set the rolling payout schedule —`, e.message)
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
