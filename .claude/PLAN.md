# PLAN — identity "not enabled" error surfacing + flaky test
## Phase 1 Architecture
ROOT CAUSE of his report (from prod error_logs): Stripe Identity is NOT enabled on the account.
Owner must enable at dashboard.stripe.com/identity/application. Not a code bug.
CODE FIXES: lib/stripe/identity.ts isIdentityNotEnabled(); admin + cleaner routes now say why;
cleaner route also CLEARS the hold and alerts admins so no cleaner loses a job over it. [done]
FLAKE (separate, pre-existing, commit b40d294): tests/unit/formatCurrency.test.ts timed out at
5720ms vs vitest 5s default — Node loading German locale data on first use under load.
CHANGED vitest.config.ts — testTimeout 20s.
## Phase 2 Tasks
1. detector + route messages [done]  2. tests [done]  3. vitest timeout  4. tsc/tests/build
5. commit, push, deploy, re-register crons, verify
## Phase 4 Health check: suite green repeatedly under load; identity error now names its cause.
