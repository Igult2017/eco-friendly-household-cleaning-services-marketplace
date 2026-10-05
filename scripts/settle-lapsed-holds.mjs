// One-off repair: find bookings that can never be settled because their card hold is already gone,
// and close them out.
//
// Background. A booking's money is a HOLD on the client's card, and Stripe releases an uncaptured
// hold by itself after ~7 days. Nothing wrote that back to us, so payments.status still says
// "authorized". Until the fix in lib/stripe/resolveHold.ts, every attempt to cancel such a booking
// hit Stripe with a dead PaymentIntent, Stripe refused, and the request died as a bare "Internal
// server error" — leaving the booking permanently stuck in Confirmed with nobody able to close it.
//
// The fix means a human clicking Cancel now works. This script is for the ones nobody will click:
// it finds them in bulk and closes them. No money moves — the hold is already gone, so the client
// was never charged and there is nothing to refund.
//
// SAFETY: dry run by default — prints what it WOULD do and changes nothing. Pass --apply to write.
// Only touches bookings that are (a) still awaiting service, (b) scheduled more than --days ago
// (default 8, past the ~7-day hold lifetime), and (c) confirmed by Stripe to have a cancelled
// PaymentIntent. A booking failing any one of those is left alone.
//
// Run where the database host resolves and STRIPE_SECRET_KEY is set (the deploy/build step, same
// place scripts/ensure-referrals.mjs runs):
//   node scripts/settle-lapsed-holds.mjs                 # report only
//   node scripts/settle-lapsed-holds.mjs --apply         # actually close them
//   node scripts/settle-lapsed-holds.mjs --days=14 --apply
import postgres from "postgres"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const DAYS = Number(args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 8)

const DB_URL = process.env.DATABASE_URL
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1) }
if (!STRIPE_KEY) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1) }
if (!Number.isFinite(DAYS) || DAYS < 1) { console.error("--days must be a positive number"); process.exit(1) }

// Raw REST rather than the `stripe` package: this may run inside the standalone production build,
// where only modules the server bundle references are kept in node_modules (see
// scripts/migrate-connect-payout-settings.mjs for the same constraint).
async function getIntent(id) {
  const res = await fetch(`https://api.stripe.com/v1/payment_intents/${id}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`)
  return data
}

const sql = postgres(DB_URL, { max: 2 })

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no changes)"} · older than ${DAYS} days\n`)

  const candidates = await sql`
    SELECT b.id,
           b.booking_number,
           b.status,
           b.scheduled_at,
           b.total_amount,
           p.stripe_payment_intent_id AS pi
    FROM bookings b
    JOIN payments p ON p.booking_id = b.id
    WHERE b.status IN ('payment_authorized', 'confirmed')
      AND p.status = 'authorized'
      AND b.scheduled_at < NOW() - (${DAYS} || ' days')::interval
      AND p.stripe_payment_intent_id IS NOT NULL
    ORDER BY b.scheduled_at ASC
  `

  if (candidates.length === 0) {
    console.log("No stuck bookings found. Nothing to do.")
    return
  }
  console.log(`${candidates.length} booking(s) past service date with a hold we still think is live.\n`)

  let dead = 0
  let stillLive = 0
  let unreadable = 0

  for (const b of candidates) {
    let intent
    try {
      intent = await getIntent(b.pi)
    } catch (e) {
      unreadable++
      console.log(`  ?  ${b.booking_number}  could not read payment (${e.message}) — LEFT ALONE`)
      continue
    }

    if (intent.status !== "canceled") {
      stillLive++
      console.log(`  ·  ${b.booking_number}  hold is "${intent.status}", not dead — LEFT ALONE`)
      continue
    }

    dead++
    const when = new Date(b.scheduled_at).toISOString().slice(0, 10)
    console.log(`  ✗  ${b.booking_number}  scheduled ${when}, hold released by Stripe — ${APPLY ? "closing" : "would close"} (nothing charged)`)

    if (!APPLY) continue

    // Booking + payment together: the money state must never diverge from the booking state.
    await sql.begin(async (tx) => {
      await tx`
        UPDATE bookings
        SET status = 'cancelled',
            cancellation_reason = 'Payment hold expired before the job was completed — closed automatically. Nothing was charged.',
            cancelled_at = NOW(),
            cancelled_by = 'system',
            updated_at = NOW()
        WHERE id = ${b.id}
      `
      await tx`UPDATE payments SET status = 'cancelled' WHERE booking_id = ${b.id}`
      // Audit row, same table the cancel endpoint writes to. Zero fee, zero refund — correct here:
      // no money was ever taken, so none was given back.
      await tx`
        INSERT INTO booking_cancellation_events
          (booking_id, actor_user_id, actor_role, action, scheduled_at, status_before,
           cancellation_fee_amount, travel_compensation_amount, refund_amount, reason)
        VALUES (${b.id}, NULL, 'system', 'cancelled', ${b.scheduled_at}, ${b.status},
                0, 0, 0, 'Payment hold expired before completion — closed by settle-lapsed-holds')
      `
    })
  }

  console.log(`\nSummary: ${dead} dead hold(s), ${stillLive} still live, ${unreadable} unreadable.`)
  if (dead > 0 && !APPLY) console.log("Re-run with --apply to close the dead ones.")
}

main()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1) })
