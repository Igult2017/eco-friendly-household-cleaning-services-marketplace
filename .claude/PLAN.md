# PLAN — Stripe Identity error surfacing + test timeouts under load
## Phase 1 Architecture
ROOT CAUSE of his report (prod error_logs): Stripe Identity NOT enabled on the account. Owner must
enable it at dashboard.stripe.com/identity/application. Not a code bug.
CODE: lib/stripe/identity.ts isIdentityNotEnabled(); admin + cleaner routes name the cause; the
cleaner route also clears the hold and alerts admins so nobody loses a job over it. [done]
FLAKES (both only under artificial load - a production build running alongside the suite):
  1. formatCurrency.test.ts 5.7s - Node loading German locale data on first use (pre-existing)
  2. identitySettings.test.ts 31s - PGlite is WebAssembly, pure CPU, starves under load (mine)
CHANGED vitest.config.ts - testTimeout 60s, hookTimeout 120s. Idle the suite is ~23s/155 tests.
## Phase 2 Tasks
1. detector + route messages [done] 2. tests [done] 3. timeouts 4. verify idle AND loaded
5. tsc/build 6. commit, push, deploy, re-register crons
## Phase 4 Health check: repeated green runs; identity failure now names its cause.
