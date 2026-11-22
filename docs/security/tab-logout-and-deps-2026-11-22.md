# Security assessment — tab-close logout + dependency fixes (2026-11-22)

**Scope:** commit `51a481f` (sign out when the last tab closes; idle-rule fix; home-page
formatting fix) and the dependency updates deployed in `e7d1874`.
**Target:** `https://xn--dorix-fsa.com` (production). Both deployments `finished`.

## What was run

| Layer | How | Result |
|---|---|---|
| Passive scan | OWASP ZAP 2.16.1, Automation Framework, spider with form submission OFF, passive rules only | 0 High · 1 Medium · 2 Low · 6 Info |
| Dependencies | `npm audit --omit=dev` before and after | critical 2 → **0**, high 15 → **2** |
| Secrets | diff of `51a481f` scanned for keys/tokens/passwords | clean |
| Code review | logout logic read line by line; unit + real-browser tests | see below |
| Active / authenticated scan | **not run** — there is no staging environment, and active scans must never target production | — |

## Passive scan findings (all pre-existing, none from this change)

| Severity | Finding | Status |
|---|---|---|
| Medium | Content-Security-Policy not enforced (5) | Same as the 2026-06-25 report; a Report-Only policy is already sent. Deferred: enforcing it needs the Clerk/Stripe/Pusher allowlist tuned against real browser violations first. |
| Low | Cookie without HttpOnly (11) | Pre-existing; Clerk's session cookie is read by its browser SDK by design. |
| Low | Cross-domain script include (11) | Clerk / Stripe / analytics scripts — expected. |
| Info | Report-Only CSP found, cache-control, suspicious comments, etc. | Informational. |

## The change itself

- **What it does:** on a tab's first load, if the tab is fresh (no per-tab mark in
  `sessionStorage`) and no other tab of the site is alive (per-tab heartbeat in `localStorage`,
  removed on `pagehide`), it calls Clerk `signOut()`. Verified: Clerk reports the ended session as
  `removed` — it is ended at Clerk, not just forgotten by the browser.
- **Abuse check:** the storage keys hold only a random tab id and timestamps — no credentials.
  Tampering with them can only cause *more* sign-outs (deleting the keys) or keep a session that is
  already valid (forging a heartbeat) — it cannot grant access. The server still enforces Clerk's
  own session lifetime.
- **Exemptions** (Stripe return parameters, `/sign-in`, `/sign-up`) only *skip a sign-out*; they
  grant nothing.
- **Limit:** this is a convenience control in the browser. The real ceiling is Clerk's session
  lifetime — measured on the dev instance as 168h inactivity / 720h maximum. **The production value
  was not measured** (reading the production key was refused by the permission system). Recommended:
  Clerk Dashboard → Configure → Sessions → set inactivity timeout to 1 hour.

## Dependency fixes deployed

- `@sentry/nextjs` 10.61.0 → 10.78.0 — **critical** "Middleware Bypass when using Tunnel route";
  this app uses the tunnel (`/monitoring`). Tunnel answers the same after the upgrade.
- `proxy-addr` (critical), `body-parser`, `fast-uri`, `postcss`, `brace-expansion`, `browserslist`,
  `source-map-js`, `systeminformation`, `@grpc/grpc-js`, `prosemirror-view` (high) — in-range
  updates via `npm audit fix`.
- `@tiptap/*` ^3.26.0 → ^3.35.0, all together — `npm audit fix` had left the editor with mismatched
  parts (npm marked it "invalid"); moving all of them fixes that and the tiptap advisories.
- `@opentelemetry/auto-instrumentations-node` forced to ^0.83.1 inside `inngest` via
  `package.json` `overrides` (in inngest's own allowed range) — clears the Jaeger propagator DoS.
- Our own `zod` 4.4.3 → 4.6.7.
- Verified after: `tsc --noEmit` clean, 218/218 unit tests, `node --check scripts/*.mjs`, live `/`,
  `/sign-in`, `/blog` = 200, Inngest re-registered (`modified: true`).

## Deferred, with reason

| Item | Why it stays |
|---|---|
| `zod` 3.25.76 bundled inside `inngest` (high: memory exhaustion on oversized collections) | Even the newest `inngest` (4.26.2) depends on `zod ^3.25`, and every 3.x is inside the advisory range (<4.6.6). No fixed version exists. It validates Inngest's own signed payloads, not user input. Re-check when inngest moves to zod 4. |
| CSP enforcement (Medium) | See above. |
| OS updates (78 incl. Docker, kernel) + Traefik 3.6.25 on the VPS | Owner decided to leave them on 2026-11-22. |
