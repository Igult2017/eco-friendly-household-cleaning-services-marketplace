# PLAN — admin-testable identity check + recurring dates on the calendar
Phase 1 Architecture: identity settings/gate/admin-test route/onboarding step; and
lib/bookings/recurringProjection.ts feeding both calendar pages. No DB schema changes.
Phase 2: tasks 1-13 done. 14 = tsc/tests/build. 15 = commit, push, deploy, re-register crons.
Phase 4: health check — found and fixed the deadline sweep ignoring the off switch.
