# PLAN — test-account switch so he can test without paying real people
## Phase 1 Architecture (gates found by reading, not inference)
FIVE gates block self-testing, in TWO files:
  app/api/jobs/[id]/bids/route.ts:73  same user id   -> "Cannot bid on your own job"
  app/api/jobs/[id]/bids/route.ts:76  same IP        -> "Cannot bid on your own job"
  app/api/jobs/[id]/bids/route.ts:91  DISTANCE       -> refuses when km==null OR km>radius
  app/api/jobs/[id]/take/route.ts:73  same user id   -> "Cannot take your own job"
  app/api/jobs/[id]/take/route.ts:75  same IP        -> "Cannot take your own job"
The DISTANCE one matters most: it refuses when the cleaner has NO coordinates, which is his case
(Kisumu is not in SUPPORTED_COUNTRIES). Two accounts alone would still be blocked by IP+distance.
NO self-booking gate exists — booking a cleaner directly already works for self-testing.

CHANGED scripts/ensure-referrals.mjs  users.is_test_account bool; bookings.is_test bool
CHANGED lib/db/schema/{users,bookings}.ts
NEW     lib/testing/testAccount.ts  isTestParticipant(userIds) - ONE place deciding a bypass
CHANGED the 2 route files above - bypass when EITHER side is a test account
CHANGED app/(admin)/admin/users/page.tsx + a small API route - the switch
CHANGED lib/bookings/create.ts - stamp bookings.is_test when either side is a test account
CHANGED admin overview revenue query - exclude is_test bookings so figures stay true
## Phase 2 Tasks
1 columns 2 shared helper 3 bypass in both routes 4 admin switch 5 stamp + exclude from revenue
6 tests 7 tsc/tests/build 8 commit, push, DEPLOY (live is 3 commits behind), re-register crons
## Phase 4 Health check: every one of the five gates bypassed; revenue excludes test bookings.
