# DORIXÉ SEO & AI-Search Roadmap

Status doc for the SEO/GEO work. Market: **platform is based in Germany**; target is
**all main European languages + English (USA)**. (The "Kisumu" data in the app is the
developer's test data, not a target market.)

Last updated: 2026-06-17.

---

## ✅ DONE & LIVE IN PRODUCTION (verified)

Foundational technical SEO + AI-search readiness (commit `998a181`, deployed manually):

- `lib/seo/site.ts` — canonical `SITE_URL` (env `NEXT_PUBLIC_SITE_URL`, default apex punycode `https://xn--dorix-fsa.com`), brand constants, `absoluteUrl()`.
- `lib/seo/schemas.ts` — JSON-LD builders: Organization, WebSite (+ SearchAction), Service, BreadcrumbList, FAQPage, provider `HomeAndConstructionBusiness` (+ AggregateRating + Offer + Review).
- `components/seo/JsonLd.tsx` — script injector.
- Root layout: `metadataBase`, canonical, Twitter card, OG (url + image), Organization + WebSite JSON-LD.
- `app/robots.ts` — allow all; **explicitly allows AI crawlers** (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot…); disallows private routes (`/admin /api /dashboard /provider/ /book /onboarding /recurring /bookings /sign-in /sign-up /post-job`).
- `app/sitemap.ts` — public static routes + dynamic approved-provider profiles.
- `app/manifest.ts` — PWA basics.
- `public/llms.txt` — AI-crawler site summary.
- `public/og-default.png` — 1200×630 branded OG image.
- Page JSON-LD: pricing → FAQPage; provider profile → LocalBusiness + ratings + offers + reviews.

Live-check passed: robots.txt, sitemap.xml (URLs present), llms.txt 200, og image 200, homepage has 2 JSON-LD blocks.

---

## 🔬 COMPETITOR AUDIT — KEY FINDINGS (live research, 2026-06-17)

Competitors: **EU** Helpling (~120–130 city pages `/putzfrau/{city}/`), Batmaid (ccTLD + `/de /fr /it` + `/end-of-tenancy/`). **US** Molly Maid (~464 location pages), The Cleaning Authority (~200+), TaskRabbit (`/locations/{city}/house-cleaning` + `/near-me/house-cleaning`), Handy, Homeaglow ("from $19" price anchor).

**The two gaps DORIXÉ must close:**
1. **Programmatic city × service landing pages** — every competitor's main organic engine. DORIXÉ has 0.
   - Title formula to copy: `"[Service] in [City] | DORIXÉ"` / native: `"Putzfrau in {Stadt} finden | DORIXÉ"`. H1 mirrors title.
2. **Off-site citation graph** (reviews + directories + Reddit) — drives both classic local SEO and AI citations.

**DORIXÉ's moat:** eco/non-toxic is a *brand*, not an add-on (competitors treat it as optional). Win the eco-modifier keywords they ignore.

---

## 🎯 KEYWORD STRATEGY

Don't fight `house cleaning near me` (KD 72) head-on as a new domain. Win the eco lane + long-tail + city programmatic.

**Target first (low comp, high intent):**
1. `non-toxic house cleaning [city]` 2. `chemical-free house cleaning` 3. `pet-safe cleaning service [city]` 4. `eco friendly cleaning service [city]` 5. `are eco-friendly cleaning products as effective?` (AI-Overview bait) 6. `how much does eco/green cleaning cost?` 7. `deep cleaning vs move-out cleaning` 8. `eco end of tenancy cleaning [UK city]` 9. `sustainable office cleaning [city]` (B2B, wide open) 10. `fragrance-free / allergy-safe cleaning`

German market terms: `Putzfrau`, `Reinigungskraft`, `Haushaltshilfe`, `Büroreinigung` + `[Stadt]`.

---

## 🤖 AI-SEARCH (GEO)

On-site foundation done (robots allow AI bots, llms.txt, JSON-LD). But own-site is only ~5–10% of AI citations. **The rest is off-site (business/you must do):**
- Google Business Profile per service-city (biggest local-AI lever, ~3× citation lift).
- Review velocity on Trustpilot / Yelp / Google.
- Reddit presence (Perplexity's #1 source).
- Listicle/"best eco cleaner in [city]" inclusions (digital PR); eventually Wikidata/Wikipedia entity.
- Directories: Google Business, Bing Places, Trustpilot, Bark, Europages, Kompass, WLW (DE).
- On-page extraction aids: comparison tables (eco vs conventional), HowTo "book a green cleaner", expanded FAQ blocks.
- Submit sitemap to Google Search Console + Bing Webmaster Tools.

---

## ⏭️ NEXT UP (where we paused) — i18n URL migration (THE KEYSTONE)

**Decision:** full multilingual via URL-based locales `/de /en /fr /es /it /nl /pl /pt` + hreflang.
**Why critical:** platform is German-market, but cookie-based locale means Googlebot only sees **English** and the German content (the actual market!) is **not indexable**.

**Recommended phasing:**
- **Phase 1 (do first): localize ONLY the public route group** to `/[locale]/...` for all 8 locales + hreflang + per-locale sitemap. Keep dashboards (`/admin /customer /provider /auth`) on the current flat/cookie setup (they're `noindex`). Captures ~100% of SEO value at a fraction of the risk.
- **Phase 2 (optional): migrate the app/dashboards too.**

**Blast radius (measured):** ~56 files import `next/link`, 127 `<Link>` instances, 53 `next/navigation` usages; plus middleware (auth perimeter), root layout, sitemap, metadata. Translation message files for all 8 locales already exist (`messages/*.json`) — work is structural, not translation.

**Phase 1 step plan:**
1. `i18n/routing.ts` — `defineRouting({ locales, defaultLocale: 'de', localePrefix: 'as-needed' })` (decide: prefix `as-needed` keeps `de` at root, or `always` for clean per-locale URLs — pick `always` if `en`/US needs its own clean URL; lean `always`).
2. Update `i18n/request.ts` to use routing.
3. Create `i18n/navigation.ts` (`createNavigation(routing)`) → locale-aware `Link`, `useRouter`, `redirect`, `usePathname`.
4. Compose **next-intl middleware with Clerk** in `middleware.ts` (order matters; only locale-handle public paths).
5. Move `app/(public)/*` under `app/[locale]/(public)/*`; add `app/[locale]/layout.tsx` with `generateStaticParams` + `setRequestLocale`.
6. Swap public-page `next/link` + `next/navigation` imports → `@/i18n/navigation`.
7. hreflang: `alternates.languages` in metadata (helper in `lib/seo`).
8. Sitemap: emit each public URL × 8 locales with `alternates`.
9. Locale switcher + `LocaleDetector`: navigate by URL, not cookie.

**Risk:** high — rewrites routing + auth perimeter; can't fully QA locally (slow dev, prod DB unreachable, auth-gated pages). Commit in safe increments; spot-check on prod (Igult to verify auth pages). Read `node_modules/next/dist/docs/` + next-intl v4 docs before coding (per AGENTS.md).

---

## 🧹 BACKLOG / SMALLER FIXES

- **City × service landing pages** (after i18n) — German cities first (Berlin, München, Hamburg, Köln, Frankfurt, Stuttgart, Düsseldorf…), eco angle baked into titles/H1, local pricing, real cleaner lists, FAQ + LocalBusiness schema.
- **Blog cluster** for question keywords (eco effectiveness, cost guides, deep vs move-out).
- **`move-cleaning` slug mismatch**: seed/homepage use `move-cleaning`, booking step (`app/(customer)/book/page.tsx`) uses `move-in-out` → that category won't match at checkout. Reconcile slugs across seed, homepage ServiceGrid, book page.
- **Canonical host**: confirm www vs apex; set up a single 301 redirect and set `NEXT_PUBLIC_SITE_URL` accordingly (currently defaults to apex punycode).
- **`og:locale`**: root layout OG locale is `en_EU`/`en_GB` — switch primary to `de_DE` with alternates once locales are URL-based.
