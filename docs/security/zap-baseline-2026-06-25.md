# OWASP ZAP Security Report — DORIXÉ

- **Tool:** OWASP ZAP (Zed Attack Proxy) **v2.17.0**
- **Target:** `https://xn--dorix-fsa.com` (production, `dorixé.com`)
- **Date:** 2026-06-25
- **Scan type:** **Baseline / passive** (spider + passive analysis). Form submission was **disabled** so the crawler could not create bookings, send emails, or mutate production data.
- **Coverage:** 391 URLs discovered and analysed.
- **Not performed:** Active/attack scanning (SQLi, XSS, injection payloads) and authenticated scanning — these should be run against a **staging/local** instance, never production (see *Next steps*).

## Result summary

| Severity | Count |
|---|---|
| 🔴 High / Critical | **0** |
| 🟠 Medium | 3 |
| 🟡 Low | 6 |
| ⚪ Informational | 5 |

**No High or Critical issues.** The findings are standard hardening gaps — missing Content-Security-Policy, an information-leak header, cookie flags, and headers on the analytics proxy. All are low-effort, high-value fixes.

What's already good (confirmed by the scan): HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` are all present on the main responses.

---

## 🟠 Medium findings

### M1. Content-Security-Policy header not set (CWE-693, 5 instances)
No CSP is sent. CSP is the strongest defence-in-depth against XSS and data injection. This is the single highest-value fix.

**Where:** all HTML responses (`/`, `/de`, `/sign-in`, …).

**Fix:** add a CSP in [next.config.ts](../../next.config.ts) `headers()`. Because the app loads Clerk, Stripe, Pusher and Umami, the policy must allow those origins. **Deploy in *Report-Only* mode first** (`Content-Security-Policy-Report-Only`) — a wrong CSP silently breaks the Clerk/Stripe widgets. Watch the browser console for `Refused to…` violations, fix the allowlist, then switch the header name to `Content-Security-Policy` to enforce.

Starter policy (tune against real console output):
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.xn--dorix-fsa.com https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com;
connect-src 'self' https://clerk.xn--dorix-fsa.com https://*.clerk.accounts.dev https://api.stripe.com https://*.pusher.com wss://*.pusher.com https://*.ingest.sentry.io;
img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://*.stripe.com;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://clerk.xn--dorix-fsa.com;
worker-src 'self' blob:;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
```
Notes:
- `'unsafe-inline'`/`'unsafe-eval'` weaken `script-src` but Clerk's `clerk-js` and Next's inline bootstrap currently need them. The ideal is a **nonce-based** CSP (stronger), which is more work in Next.js — a reasonable phase-2.
- Clerk publishes an exact CSP allowlist — cross-check it (the project has Clerk skills/docs available) before enforcing.
- `frame-ancestors 'none'` supersedes `X-Frame-Options` in modern browsers (keep both).

### M2. Sub-Resource Integrity (SRI) attribute missing (CWE-345, 5 instances)
**Where:** Clerk's runtime-injected scripts, e.g. `https://clerk.xn--dorix-fsa.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js`.

**Assessment:** these are injected by Clerk's loader (you don't author the tags), and they're served from **your own Clerk subdomain over HTTPS**, so practical risk is low. True SRI isn't feasible for Clerk's auto-updated runtime. **Mitigation:** a tight `script-src` allowlist in the CSP (M1) is the realistic control here. No code change beyond M1.

### M3. Cross-Domain misconfiguration — `Access-Control-Allow-Origin: *` (CWE-264, 1 instance)
**Where:** `/_a/script.js` — this is the **Umami analytics script**, served through your same-origin `/_a` proxy from the upstream Umami server, which sets `ACAO: *`.

**Assessment:** it's a public, static analytics script, so `*` is low-risk. **Fix (optional):** strip/override `Access-Control-Allow-Origin` on the `/_a/:path*` proxy responses (see L1 — same root cause: proxied responses don't inherit the app's header policy).

---

## 🟡 Low findings

### L1. Security headers missing on the `/_a` analytics proxy (HSTS + nosniff)
**Where:** `/_a/script.js` lacks `Strict-Transport-Security` and `X-Content-Type-Options` even though the rest of the site has them.

**Root cause:** [next.config.ts](../../next.config.ts) rewrites `/_a/:path*` to the external Umami server; the `headers()` rule (`source: "/(.*)"`) is **not applied to externally-rewritten responses**, so the upstream's headers pass through. Combined with M3, the proxied analytics responses are the one spot without the app's header policy.

**Fix:** add the security headers (and override `ACAO`) to the proxied responses — either a dedicated `headers()` block keyed to `/_a/:path*`, or set them in `middleware.ts` for that path (it currently early-returns for `/_a`). Low priority (static analytics asset).

### L2. `locale` cookie missing `HttpOnly` flag (CWE-1004, 5 instances)
### L3. `locale` cookie missing `Secure` flag (CWE-614, 5 instances)
**Where:** the `locale` cookie set by `next-intl`.

**Assessment:** non-sensitive (just the chosen language), so impact is low — but flags should still be set. **Fix:** configure the cookie in [i18n/routing.ts](../../i18n/routing.ts) `localeCookie`:
```ts
localeCookie: { name: "locale", secure: true, sameSite: "lax" }
```
`Secure` + `SameSite=Lax` are safe to add immediately. Add `httpOnly: true` only after confirming the locale switcher doesn't read the cookie client-side (next-intl resolves it server-side, so it should be fine — test the language switcher after).

### L4. Cross-domain JavaScript inclusion (CWE-829, 5 instances)
**Where:** Clerk JS loaded from `clerk.xn--dorix-fsa.com`. **Intentional** — that's your Clerk Frontend API subdomain. No action; the CSP `script-src` allowlist (M1) is the control.

### L5. Server leaks `X-Powered-By: Next.js` (CWE-497, 5 instances)
Minor fingerprinting. **Fix (trivial):** add `poweredByHeader: false` to the top level of [next.config.ts](../../next.config.ts).

---

## ⚪ Informational (no/low action)

- **Content-Type header missing** on `/admin`, `/api`, `/book` — these are `307` redirects to sign-in with empty bodies; benign.
- **Modern Web Application** — informational classification of the SPA-style app; no action.
- **Information Disclosure – Suspicious Comments** — the token `query` matched inside minified `_next` JS chunks; effectively a false positive.
- **Re-examine Cache-Control** — public ISR pages send `s-maxage=3600, stale-while-revalidate=…`. Intended for public marketing pages. ✅ Verify no **authenticated** page (dashboard/admin) is ever served with a shared-cache directive (they shouldn't be — those are `no-store`).
- **User-Controllable HTML Element Attribute (Potential XSS)** — `/sign-in?redirect_url=…` is reflected. Clerk validates `redirect_url` to same-origin; **verify** it can't be pointed off-domain (open-redirect), then dismiss.

---

## Prioritised remediation plan

| # | Fix | Effort | Where |
|---|---|---|---|
| 1 | **Add CSP** (Report-Only → enforce) | M | `next.config.ts` `headers()` |
| 2 | `poweredByHeader: false` | XS | `next.config.ts` |
| 3 | `locale` cookie `Secure` + `SameSite` | XS | `i18n/routing.ts` |
| 4 | Security headers + ACAO on `/_a` proxy | S | `next.config.ts` / `middleware.ts` |
| 5 | Verify `redirect_url` can't open-redirect | XS | sign-in flow (Clerk) |
| 6 | (Phase 2) nonce-based strict CSP | L | `next.config.ts` + layout |

## Next steps — active & authenticated testing
This baseline only covers **passive, unauthenticated** surface. To catch injection/access-control bugs:
1. Run an instance locally or on staging (never prod).
2. Run `zap-full-scan` (active) and an **authenticated** scan (a Clerk session token / context) against it.
3. Re-run after the CSP work to confirm the header is present and not breaking widgets.

*Raw ZAP HTML report saved at `C:\Users\FSD\zap-baseline-2026-06-25.html` (full interactive output, not committed due to size).*
