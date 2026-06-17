# DORIXÉ Feature Backlog

Tracked features not yet built. Each lists where it plugs in, the decisions needed
(especially money flow), and rough effort — so they can be picked up cleanly.

Added 2026-06-17.

---

## 1. Recurring booking discount  🟠 moderate
Give recurring bookings (weekly / bi-weekly / monthly) a lower per-clean price than
one-off bookings — the standard loyalty lever and what the marketing copy implies.

**Where it plugs in**
- `lib/bookings/create.ts` and `lib/inngest/functions/recurring.ts` — apply the discount to the subtotal before `calculateBookingAmounts`.
- `app/api/payments/intent/route.ts` — reflect it in the quoted amount.
- `lib/platform/settings.ts` + admin **Settings** page — make the % admin-configurable (same pattern as `commission_pct`).
- Surface "X% recurring discount" in the booking confirm UI.

**Decisions needed (money flow — must confirm before building)**
- **Amount:** single % for any recurring, or per-frequency (e.g. weekly 10%, bi-weekly 7%, monthly 5%)?
- **Who funds it:** the **provider** (lower payout — they trade a small discount for guaranteed steady work — *recommended*, and how most marketplaces do it) or the **platform** (off its commission)? This decides whether `providerPayout` or `platformFee` shrinks.
- Cap the discount so it can never exceed the margin available.

---

## 2. Service add-ons (oven, window, ironing, fridge…)  🟠 small–moderate
Selectable paid add-ons in the booking **extras** step (today that step only has eco
preferences + special instructions).

**Where it plugs in**
- `app/(customer)/book/extras/page.tsx` + `stores/bookingStore.ts` — add an `addOns` selection.
- `app/api/payments/intent/route.ts` + `lib/bookings/create.ts` — add add-on prices to the subtotal (so they flow into the PI amount, platform fee, and provider payout).
- i18n for the add-on labels across all 8 locales.

**Decisions needed**
- **Pricing source:** platform-set flat prices (simple, admin-managed — *recommended to start*) vs provider-set (needs a provider UI + DB). Cleaner-set rates make per-provider add-on pricing the "correct" long-term answer, but flat platform prices ship far faster.
- **Which add-ons:** oven cleaning, interior window cleaning, ironing, inside fridge, inside cabinets, laundry.
- Does the add-on price go fully to the provider, or is it commissionable like the base?

---

## 3. Pricing model — DECISION (home-size vs hourly)  ✅ decided
Keep **hourly, cleaner-set rates** (fits an independent-contractor marketplace; matches
TaskRabbit/Helpling/Batmaid). Home-size flat pricing is a *franchise* pattern (Molly
Maid, Merry Maids) and conflicts with cleaner-set rates.

**If an "instant quote" UX is wanted later:** add **home size as a duration estimator**
(bedrooms/baths or m² → estimated hours) and show `estimated hours × cleaner rate` —
no pricing-engine rewrite. This is the practical hybrid (how Handy/Helpling work under
the hood). Effort: moderate (a sizing step in the wizard + a duration model).
