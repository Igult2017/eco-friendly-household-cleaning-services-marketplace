# PLAN — repeat cleanings charge 1 hour instead of the hours booked
## Phase 1 Architecture (evidence, not inference)
Bookings 000010/11/12/13 (6,13,20,27 Sep - exactly weekly) and 000015 charged ONE HOUR and have no
scheduled_end_at. One-off bookings 000004-000009 are all correct.
ROOT CAUSE: recurring_schedules had NO duration column; app/api/recurring/route.ts never captured
one; lib/inngest/functions/recurring.ts:172 used basePrice (one hour) with no multiplication and
set no scheduledEndAt. lib/bookings/create.ts did both correctly all along.
CLEARED: bids are whole-job totals BY DESIGN (create.ts:125); bid form already multiplies
(bids/route.ts:132). BK-2026-000014 predates that fix.
## Phase 2 Tasks
1 ensure-referrals: duration_minutes col + priced enum (enum OUTSIDE the DDL batch)   [done]
2 lib/bookings/price.ts shared rule, used by BOTH create.ts and recurring.ts           [done]
3 recurring.ts: multiply, set scheduledEndAt, refuse mismatched charge, alert admins   [done]
4 payment trail: priced event + ledger + admin history display                         [done]
5 tests (10 passing)                                                                   [done]
6 PHASE 4 FINDING: neither caller sent durationMinutes, so the API change alone did
  nothing. Fix app/(customer)/book/confirm/page.tsx AND components/booking/RecurringSetupForm.tsx
7 tsc/tests/build  8 commit, push, deploy, re-register crons, verify
## Phase 4 Health check: every caller actually sends the hours; repeat price == one-off price.
