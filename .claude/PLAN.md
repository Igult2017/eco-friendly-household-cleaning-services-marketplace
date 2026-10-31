# PLAN — repeat cleanings charge 1 hour instead of the booked hours
## Phase 1 Architecture
EVIDENCE (production, not inference): bookings 000010/11/12/13 (6,13,20,27 Sep - exactly weekly)
and 000015 charged exactly one hour (EUR20/EUR25) and have NO scheduled_end_at. One-off bookings
000004-000009 are all correct.
ROOT CAUSE: recurring_schedules has NO duration column (lib/db/schema/recurringSchedules.ts) and
app/api/recurring/route.ts never captures one, so lib/inngest/functions/recurring.ts:172 uses
baseSubtotal = service.basePrice (one hour) with no multiplication, and its insert sets no
scheduledEndAt. lib/bookings/create.ts does BOTH correctly (lines 133 and 156).
CLEARED: bids are whole-job totals BY DESIGN (create.ts:125) and the bid form already multiplies
rate x hours (bids/route.ts:132). BK-2026-000014 predates that fix.

CHANGED scripts/ensure-referrals.mjs  - ADD COLUMN IF NOT EXISTS duration_minutes (journal drift)
CHANGED app/api/recurring/route.ts    - capture the chosen duration
CHANGED lib/inngest/functions/recurring.ts - multiply per_hour by hours; set scheduledEndAt;
        refuse to charge when expected != charged; fallback 120 min flagged in the trail
CHANGED lib/db/schema/paymentEvents.ts + ensure script - new kind "priced"
CHANGED lib/payments/ledger.ts        - record rate/unit/minutes/source/expected/charged/mismatch
CHANGED app/(admin)/admin/payments/history/page.tsx - show the arithmetic
## Phase 2 Tasks
1 schema col  2 capture duration  3 recurring pricing + end time  4 priced event + ledger
5 admin display  6 mismatch guard  7 tests  8 tsc/tests/build  9 commit/deploy/re-register crons
## Phase 4 Health check: repeat pricing equals one-off pricing for the same inputs.
