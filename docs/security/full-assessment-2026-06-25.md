# DORIXÉ — Full Security Assessment

- **Date:** 2026-06-25
- **App:** DORIXÉ marketplace (Next.js 16 App Router, Clerk, Drizzle/Postgres, Stripe Connect, Backblaze B2, Pusher, Umami) — production `dorixé.com` / `xn--dorix-fsa.com`
- **Layers performed:**
  1. **DAST (passive)** — OWASP ZAP 2.17.0 baseline → see [zap-baseline-2026-06-25.md](zap-baseline-2026-06-25.md)
  2. **SCA** — `npm audit` dependency CVE scan
  3. **Secret scanning** — working tree + full git history
  4. **Manual code audit** — access-control/IDOR, payment integrity, injection/XSS/SSRF (84 API routes reviewed, no server actions exist)
- **Not yet performed:** active/attack DAST + authenticated DAST — must run against **staging/local**, never prod (see *Outstanding*).

## Headline

**No Critical issues. ~6 High, ~8 Medium, ~10 Low.** The app is fundamentally well-built — payment amounts are computed server-side (no tampering), there's no SQL injection (Drizzle is parameterized throughout), refunds are capped, the payout ledger can't double-pay, and most IDOR is correctly scoped. The High issues are concentrated in: unsanitized blog HTML, an unauthenticated file proxy, a customer-PII leak in the provider job feed, a capture-without-work fraud path, and trusting role from the Clerk webhook.

| Severity | Count |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 6 |
| 🟡 Medium | 8 |
| 🔵 Low | 10 |

---

## 🟠 HIGH

### H1 — Stored XSS: blog HTML rendered unsanitized (no CSP backstop)
- **Where:** render `components/blog/BlogContent.tsx:15` (`dangerouslySetInnerHTML`); save `app/api/admin/blog/route.ts:12` + `app/api/admin/blog/[id]/route.ts:12` (`content: z.string()`, no sanitization).
- **Risk:** TipTap-authored HTML is stored verbatim and injected into every visitor's page on `/blog/[slug]`. A payload like `<img src=x onerror=…>` runs in visitors' sessions. Authorship is admin-only (mitigates to High, not Critical), but there is **no sanitization at all** and **no Content-Security-Policy** to backstop it — so a compromised/rogue admin = site-wide XSS.
- **Fix:** sanitize on render (and save) with `isomorphic-dompurify` / `sanitize-html`, allow-listing TipTap's tags/attrs. Add a CSP (see H6/ZAP M1) as defense-in-depth.

### H2 — Unauthenticated file proxy: any private object readable by key (IDOR)
- **Where:** `app/api/files/[...key]/route.ts:12-29` (public per `middleware.ts:44`).
- **Risk:** signs a B2 download URL for **any** key with **no `auth()` and no ownership check**. Protection rests entirely on `nanoid(12)` obscurity. Dispute evidence, completion before/after photos, certifications, etc. are exposed to anyone who learns a URL (referrer leak, logs, screenshot, a party who later lost access). GDPR-sensitive. *(Confirmed not SSRF/path-traversal — the AWS SDK scopes the signed URL to the bucket.)*
- **Fix:** require `auth()`; derive the owning resource from the key (the `{userId}` segment or the owning booking/dispute/provider row) and authorize the caller (owner/party/admin, or public assets like blog/avatars) before signing.

### H3 — Provider job feed leaks full customer PII (street address + GPS + Clerk id)
- **Where:** `app/api/jobs/route.ts:146-149` (`forProvider=true`).
- **Risk:** the `jobPosts` query has **no `columns:` projection**, so every nearby open job returns `serviceAddress.line1` (street), postal code, city, exact `serviceLatitude/Longitude`, and `customerId` — **before any bid exists**. Any approved provider can scrape exact home addresses + GPS of all nearby customers. Direct GDPR violation. (Contrast `app/api/jobs/public/route.ts`, which correctly projects to safe fields.)
- **Fix:** add a `columns:` projection returning only board fields + a coarse locality (city / postal-prefix / distance bucket). Reveal exact address + coordinates + `customerId` only after a bid is accepted.

### H4 — Payment capture with no "work done"/time check + non-atomic transition
- **Where:** `app/api/bookings/[id]/complete/route.ts:33-67` → `lib/inngest/functions/completion.ts:17-23`.
- **Risk:** a provider can call `/complete` the instant a booking is `payment_authorized` (route allows skipping confirm/start), with zero photos, and immediately **capture the customer's card** — no check that `scheduledAt` passed or the job started. Enables book-and-capture fraud / collusion. Also the status transition is read-check-then-unconditional-update (unlike `confirm`/`start` which use atomic conditional `WHERE status=…`), so concurrent calls both fire `booking/completed` (Stripe's idempotency key saves it from double-charge — defense by luck).
- **Fix:** require `in_progress` (or past `scheduledAt`) and use an atomic conditional update returning rows; bail on 0 rows. Consider requiring ≥1 completion photo. **Verify the Inngest serve route enforces `INNGEST_SIGNING_KEY`** (the agent couldn't locate `app/api/inngest/route.ts` in scope) — without it, `booking/completed` could be injected directly.

### H5 — Clerk webhook trusts `role` (incl. `admin`) from the event payload
- **Where:** `app/api/webhooks/clerk/route.ts:42,64,87` (`role: resolveRole(evt.data.public_metadata)`).
- **Risk:** the DB role is written straight from the event body on user.created/updated, with signature verification as the **only** defense. A leaked/misconfigured `CLERK_WEBHOOK_SECRET` lets an attacker provision/promote a DB row to `admin`. Today admin authz reads Clerk publicMetadata (not the DB), so this is a privilege-escalation primitive rather than instant takeover — but it removes the single-secret safety margin.
- **Fix:** never raise role to `admin` from the webhook (promote only via an authenticated admin action), or re-fetch the user from Clerk and read `publicMetadata` server-side before writing. Keep signature verification.

### H6 — 5 High-severity dependency CVEs (SCA)
- **From `npm audit`:** totals — 0 critical, **5 high**, 39 moderate.
  - `ws` (8.0.0–8.20.1) — memory-exhaustion DoS
  - `engine.io` / `socket.io-adapter` — via `ws`
  - `form-data` (4.0.0–4.0.5) — CRLF injection via unescaped multipart field names
  - `hono` (≤4.12.24) — path traversal in `serve-static` on Windows via `%5C`; Lambda adapter issue
- **All have fixes available.** Mostly transitive (real-time/tooling deps).
- **Fix:** `npm audit fix` (and review the `hono`/`form-data` direct-or-transitive chain); re-run `npm audit` to confirm. Add `npm audit` (or Dependabot/Snyk) to CI so this is caught continuously.

---

## 🟡 MEDIUM

### M1 — Stripe webhook fails OPEN when Redis is down (events silently dropped)
- `app/api/webhooks/stripe/route.ts:28-30` + `lib/redis/client.ts:38-48`. The idempotency `redis.set(nx)` returns `null` both for "duplicate" **and** "Redis unavailable" → the handler returns 200 "Already processed". If Redis is down, **every** webhook (`payment_failed`, `charge.dispute.created`, `account.updated`) is dropped while Stripe sees success and stops retrying. **Fix:** make the idempotency check tri-state (set/duplicate/unavailable); on unavailable, process anyway (handlers are DB-idempotent) or return non-200 so Stripe retries.

### M2 — Unsubscribe HMAC falls back to a hardcoded secret
- `lib/marketing/unsubscribe.ts:6`: `SECRET = UNSUBSCRIBE_SECRET ?? CLERK_SECRET_KEY ?? "dev-unsub-secret"`. If neither env var is set, the public unsubscribe endpoint's token is forgeable for any (non-secret) userId → mass-unsubscribe. MAC also truncated to 32 chars. **Fix:** require `UNSUBSCRIBE_SECRET` (fail at boot in prod); remove the literal; don't truncate.

### M3 — Bid price override not bound to the service/job
- `app/api/payments/intent/route.ts:60-86`. `bidAmountCents` is accepted as the subtotal if *any* accepted bid by that provider for that amount exists on a job the caller owns — not tied to `serviceId`/the specific job. A customer with one cheap accepted bid can book an expensive service at the cheap price (provider underpaid). **Fix:** carry `bidId`, validate the bid matches the service/job, pin `bidId` in PI metadata, re-verify at capture.

### M4 — Blog comments auto-approve + no rate limit (stored-content spam)
- `app/api/blog/[slug]/comments/route.ts:49-50` (`isApproved` defaults true). One account can flood every post at machine speed. *(Not XSS — comments render React-escaped.)* **Fix:** insert `isApproved:false` + moderation, and/or add a per-user rate limiter.

### M5 — Promo-code validation: no rate limit + enumeration oracle
- `app/api/promo-codes/validate/route.ts:13-55` returns distinct 404/422/200 with no limiter → attackers enumerate and harvest live codes. **Fix:** add a rate limiter; return a uniform response for invalid/ineligible.

### M6 — `profilePhotoUrl` accepts arbitrary external URLs (not bucket-scoped)
- `lib/validations/provider.ts:13` (`z.string().url()`), rendered as raw `<img src>` (`providers/[slug]/page.tsx:114`, browse, admin). Not XSS (React escapes), but leaks viewer/admin IP+UA to an attacker host on page view + allows hotlinking. Every other upload is `startsWith(R2_PUBLIC_URL)`-checked. **Fix:** apply the same bucket-scope check.

### M7 — Pusher auth omits the `private-booking-{id}` channel
- `app/api/pusher/auth/route.ts:21-41`. Booking chat subscribes to `private-booking-${id}` but the auth route handles none → 403 (fails closed, so no eavesdropping, but **live chat silently never works**). **Fix:** add a `private-booking-` branch that loads the booking and authorizes only the customer or the provider's userId (ownership-checked, not a blanket allow).

### M8 — 6 admin routes check the JWT role without the Clerk fallback (admin lockout)
- `admin/errors`, `errors/[id]/resolve`, `promo-codes` GET/POST + `[id]`, `reviews` GET + `[id]` check `sessionClaims.metadata.role` only. In prod the session token lacks the role claim, so these **fail closed and lock out the real admin** (grant no one access). **Fix:** switch them to the shared `requireAdmin()` helper (the same root cause as the session-token issue tracked separately).

---

## 🔵 LOW (hardening)

- **L1** `app/api/stripe/connect/account` + `identity/session` — scoped to caller but no explicit `role==='provider'` assertion. Add one.
- **L2** `payments/setup-intent` — no rate limit (unbounded Stripe object creation).
- **L3** `geo/country/route.ts:19-52` — spoofable `x-forwarded-for` interpolated into outbound geo URL (host fixed → not classic SSRF; path injection only). Validate with `net.isIP`.
- **L4** `bookings/[id]/before-photos`, `complete`, `recurring/[id]` — UPDATE re-queries by `id` alone after an ownership-scoped SELECT (latent TOCTOU/IDOR). Add the ownership predicate to the UPDATE.
- **L5** `providers/[id]/addons` — doesn't filter `isApproved`/`isSuspended` (enumerates hidden providers' add-ons). Add the filter.
- **L6** `jobs?forProvider=true` — view-count inflation (no dedupe per provider).
- **L7** Recurring charge — `recurringDiscountPct` unclamped + amount tracks current `basePrice` (silent price increases off-session). Clamp 0–100; store the agreed price.
- **L8** Cancel/dispute refunds computed from `totalAmount` (excludes the €2 carbon offset) — favors platform; **confirm intended.**
- **L9 (ZAP)** `X-Powered-By: Next.js` leak → `poweredByHeader:false`. `locale` cookie missing `Secure`/`SameSite` → set in `i18n/routing.ts`. `/_a` Umami proxy missing HSTS/nosniff + `ACAO:*`.
- **L10 (ZAP)** No CSP header — see ZAP M1; doubly important as the H1 backstop.

---

## ✅ Verified secure (no action)
- **No SQL injection** — all `sql\`\`` sites use Drizzle bound parameters; no dynamic identifiers from user input.
- **Payment amount integrity** — subtotal/commission/application_fee/payout all server-side; client-sent `amount`/`price`/`discount` ignored and recomputed from DB; commission split pinned in PI metadata + re-verified at capture.
- **Intent reuse blocked** — booking creation re-fetches the PI, requires `requires_capture`, cancels + 403s on metadata mismatch.
- **Refunds** — capped at `totalAmount`, `payment.status==='captured'` precondition prevents double/over-refund; dispute resolve claws back transfer + application fee, idempotent.
- **Payout ledger** — ledger-only (no double transfer), `isNull(payoutId)` guard, `max(0, payout - refunded)`.
- **`charges_enabled` gate** before any destination charge; recurring skips suspended/unapproved.
- **Webhook signature** verified against the raw body before processing (core path solid; only the Redis fail-open nuance, M1).
- **Most IDOR** correctly scoped (bookings, bids w/ FOR UPDATE lock, reviews, disputes, notifications, GDPR export/delete, customer profile).
- **Admin authz** — all 23 `/api/admin/**` routes self-enforce the Clerk role (middleware only gates the `/admin` page); no admin route trusts the DB role.
- **Presigned upload** — authenticated, rate-limited, content-type allow-list (no SVG/HTML), 10 MB cap, **server-generated key** (no path control).
- **Open redirect** — `redirect_url` is built from the app's own origin; not user-controlled.
- **Secrets** — `.env` gitignored, nothing sensitive in git history, only a `sk_test_placeholder_build_only` build fallback in `lib/stripe/client.ts`.

---

## Remediation roadmap (suggested order)
1. **H1** sanitize blog HTML + **L10/H6** add CSP — one combined hardening change.
2. **H2** auth + ownership on the file proxy.
3. **H3** project the provider job feed (drop street/GPS/customerId) — GDPR.
4. **H4** capture guardrails (state + time + atomic update) + verify Inngest signing key.
5. **H5** stop trusting webhook role; **M2** require `UNSUBSCRIBE_SECRET`.
6. **H6** `npm audit fix` + add to CI.
7. **M1** webhook Redis fail-open; **M3** bind bid price; **M8** admin-route lockout → `requireAdmin()`.
8. Mediums M4–M7, then Lows.

## Outstanding — active & authenticated DAST
This assessment is static + passive. To finish coverage: stand up a **local/staging** instance and run ZAP `full-scan` (active) plus an **authenticated** scan as customer/provider/admin to dynamically confirm the access-control findings and probe for anything missed. Never run active scans against production.
