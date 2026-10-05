# Security review — the "comments 2" changes

**Date:** 5 October 2026
**Covers:** the cancellation fix, the cancellation fee ladder, the Stripe wording sweep, tiered
commission, the €18 minimum, and the €25 referral reward.
**Status:** code-level review complete. The live scan has **not** been run — see "What was not done".

---

## What was checked, and what was found

| Layer | Done | Result |
|---|---|---|
| Permission check on every endpoint touched | Yes | No gate weakened; details below |
| Input validation on the new fields | Yes | One allowlist added; one business risk flagged |
| Known holes in third-party packages (`npm audit`) | Yes | **1 critical, 11 high, 39 moderate — all pre-existing** |
| Secrets in the changed files and recent history | Yes | None found |
| Live attack-surface scan (OWASP ZAP) | **No** | Not possible here — see below |

---

## 1. Permission checks — nothing was loosened

Every endpoint I changed still proves who the caller is before doing anything, and still proves they
own the thing they're acting on. Checked by reading each file, not by assuming:

| Endpoint | Signed in? | Owns it? | Rate limited? |
|---|---|---|---|
| `app/api/bookings/[id]/cancel/route.ts` | line 18 | line 57 (must be the client or that cleaner) | line 20 |
| `app/api/bookings/[id]/no-show/client/route.ts` | line 22 | line 45 (must be that cleaner) | line 24 |
| `app/api/admin/settings/route.ts` | line 37 | admin role, lines 54 + 68 | n/a (admin only) |
| `app/api/referrals/route.ts` | line 26 | own record only | line 27 |
| `app/api/payments/intent/route.ts` | line 18 | must be a customer, line 32 | existing |

**One endpoint was deleted:** `app/api/platform/fee` returned the single flat commission rate. It had
**zero callers anywhere in the repo**, and with two commission rates it now returned a number that no
longer described how anything is priced. Removed rather than left to rot.

## 2. The new input, and how it is validated

The cancel endpoint now accepts a **reason category** (`illness` / `transport` / `other`), and the
first two waive the cancellation fee entirely.

**Checked:** the value is matched against a fixed list before it is used
(`app/api/bookings/[id]/cancel/route.ts:30-34`); anything unrecognised falls back to `other`. So a
hand-crafted request with a made-up category cannot buy a free late cancellation.

> ### ⚠️ Business risk, not a technical hole — the fee is effectively opt-out
>
> Nothing stops someone simply **choosing "illness"** to avoid the fee. There is no evidence step.
> This is a deliberate trade-off (demanding a doctor's note to cancel a cleaning would be worse), and
> the Terms now say we may ask for evidence where the waiver is relied on **repeatedly** — but right
> now nobody is counting. **Suggested follow-up:** a report of who has claimed a waiver more than
> twice. Every claim is already recorded in `booking_cancellation_events.reason_category`, so the
> data is there; nothing reads it yet.

## 3. What the error messages now reveal

The cancellation endpoint used to answer every failure with the single phrase "Internal server
error". It now explains what actually happened, which is the whole point of the fix. Two notes:

- On a payment failure it includes the payment provider's own message
  (`settleCancellation.ts:106-115`). Those messages are written for end users and do not contain keys
  or credentials, and the caller has already been proven to own that booking. **Accepted.**
- The catch-all at the end still says only "something went wrong on our side"
  (`cancel/route.ts:188-194`) — unexpected failures are logged, not shown.

## 4. Third-party packages — pre-existing, not introduced here

`npm audit --omit=dev` reports **51 known issues: 1 critical, 11 high, 39 moderate**. I added no new
dependencies, so every one of these was already there.

| Severity | Package | Issue |
|---|---|---|
| **Critical** | `next` | Middleware / proxy bypass in App Router apps using Turbopack with a single locale |
| High | `sharp` | Inherited image-library flaws (CVE-2026-33327/33328/35590/35591) |
| High | `@grpc/grpc-js` | Can treat unauthorised certificates as authorised in some configurations |
| High | `@tiptap/core` | `mergeAttributes()` can turn a `__proto__` key into executable DOM attributes |
| High | `postcss` | Cross-site scripting via an unescaped `</style>` |
| High | `nanoid`, `brace-expansion`, `browserslist`, `fast-uri`, 3× OpenTelemetry | Denial of service / parsing issues |

**The critical one matters here**: this app uses next-intl with per-locale routes, so the "single
locale" condition is worth confirming before dismissing it. **Recommended: upgrade Next.js and
re-run the audit as its own piece of work** — it is not part of these changes and upgrading the
framework underneath a large change set at the same time would make any breakage impossible to
attribute.

## 5. Secrets

- The changed files were scanned for live keys, private keys and hard-coded passwords — **none found**.
- Recent history for `scripts/`, `lib/` and `app/` — **none found**.
- Still outstanding from earlier work, unrelated to this change: the Backblaze master key
  (id `427334334d11`) has not been rotated.

---

## What was **not** done, and why

**The live attack-surface scan (OWASP ZAP) has not been run.** Stating this plainly rather than
letting it look complete:

1. **The tooling is not installed on this machine** — Java is not on the PATH and ZAP is not present.
   Only the June 2026 reports remain (`docs/security/zap-baseline-2026-06-25.md`).
2. **More importantly, it would currently test the wrong code.** None of these changes are deployed.
   A scan pointed at the live site today would exercise the *old* build and tell us nothing about
   this work.

**The right sequence is: deploy, then run the passive baseline scan against the deployed URL** (spider
with form submission off, so the crawl cannot create or alter real bookings).

**The deep active scan cannot be run at all** — it fires real attack payloads and must never be
pointed at production, and there is no staging instance. That remains true from the June assessment.

## Open items

| # | Item | Severity | Owner |
|---|---|---|---|
| 1 | Upgrade Next.js to clear the critical middleware-bypass advisory, then re-audit | **High** | Separate task |
| 2 | Run the passive ZAP baseline once these changes are deployed | Medium | After deploy |
| 3 | Report on repeated cancellation-fee waiver claims (the data is already recorded) | Medium | Follow-up |
| 4 | Rotate the Backblaze master key `427334334d11` | Medium | Pre-existing |
