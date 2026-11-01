# PLAN — audit every admin settings switch
## Phase 1 Architecture (read-only audit + one test file)
Method: for each of the 23 editable settings, trace page -> save API -> getter -> CALLER.
FINDINGS SO FAR (all by reading, not inference):
  - Every getter has at least one live caller. No completely dead setting.
  - payout_schedule applies at ACCOUNT CREATION only (connect.ts:60-62); accounts.update at :97
    only patches the business profile. The UI already discloses this. OK.
  - reminder/deadline/availability hours are read inside step.run BEFORE a long sleepUntil
    (reminders.ts:108,145,146). Inngest memoizes step results, so a booking already in flight keeps
    the OLD value. Changing them affects NEW bookings only. NOT disclosed in the UI.
NEW tests/unit/adminSettings.test.ts - changes each setting in a real DB and asserts the reader
returns it, plus out-of-range values falling back to safe defaults.
No production code change unless the audit finds a broken switch.
## Phase 2 Tasks
1 trace all 23  2 write the verification test  3 run it  4 report findings + any fix needed
## Phase 4 Health check: no setting saves without taking effect; bounds hold.
