# PLAN — commission in the paper trail + deploy the identity error fix
## Phase 1 Architecture
THREE items from his message:
1 Paper trail does NOT currently show commission. Add commission, commissionPct and payout to
  explainPrice (lib/bookings/price.ts) and to both call sites (recurring.ts, create.ts).
2 His screenshot shows "Internal server error" on the CLEANER identity page because the fix that
  names the real cause is COMMITTED BUT NOT DEPLOYED — live container is c77c69a, HEAD is 5
  commits ahead. Deploying is the fix for the message; Stripe Identity still has to be enabled.
3 Stripe Identity CANNOT be enabled by API. Stripe docs: "Activate Identity in the Dashboard."
  It is a product sign-up with terms. The key in Coolify cannot do it. Tell him plainly.
CHANGED lib/bookings/price.ts, lib/inngest/functions/recurring.ts, lib/bookings/create.ts
No DB change (metadata is jsonb). No new settings.
## Phase 2 Tasks
1 explainPrice gains commission/payout  2 both call sites pass them  3 tests
4 tsc/tests/build  5 commit, push, DEPLOY (5 commits behind), re-register crons, verify
## Phase 4 Health check: trail shows charge AND split; cleaner page shows the real reason.
