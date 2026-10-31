# PLAN — let cleaners enter HOURS, not minutes
## Phase 1 Architecture
His report: having to type minutes instead of picking hours when booking.
FINDING: the CLIENT side already speaks hours — the booking wizard renders "2 hours"/"3 hours"
buttons (app/(customer)/book/schedule/page.tsx:286, buildDurationOptions at :42) and post-job uses
estimatedHours. The CLEANER side does not:
  - bid form  app/(provider)/provider/jobs/page.tsx:370  raw number box, label "(mins)"
  - services  app/(provider)/provider/profile/services/page.tsx:280  number box, step 30
So clients pick hours and cleaners do mental arithmetic. MONEY ANGLE: a bid amount is a per-hour
rate multiplied by this duration (app/api/jobs/[id]/bids/route.ts:132), so a cleaner typing "2"
meaning 2 hours is rejected by the 30..480 bound with a message that does not explain itself.

MINUTES STAYS the stored unit — 90 minutes = 1.5 hours needs it. Only the INPUT changes.
NEW lib/utils/duration.ts — hour options + minutes<->hours helpers, shared.
CHANGED the two cleaner inputs to the same button-picker the client already uses.
CHANGED messages/*.json (8 locales) — labels say hours.
## Phase 2 Tasks
1 duration helper  2 bid form picker  3 services picker  4 8 locales  5 tests
6 tsc/tests/build  7 commit, push, deploy, verify
## Phase 4 Health check: no screen asks a human for minutes; stored values still minutes.
