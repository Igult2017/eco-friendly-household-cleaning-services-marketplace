# DORIXÉ — AI Search (GEO) & SEO Checklist

How DORIXÉ gets surfaced and cited by AI answer engines (ChatGPT, Gemini, Claude, Perplexity,
Google AI Overviews) and classic search. **The code is only step 1.** AI engines surface a site via
live retrieval from search indexes (Bing for ChatGPT, Google for Gemini/AI Overviews, Perplexity's
own + others) — so being *indexed* and *authoritative* is what actually gets us cited.

---

## ✅ Done in code (the technical foundation)

- **AI crawlers explicitly allowed** in `app/robots.ts` (GPTBot, OAI-SearchBot, ChatGPT-User,
  ClaudeBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended,
  Amazonbot, Meta-ExternalAgent, CCBot).
- **Structured data (schema.org JSON-LD)** in `lib/seo/schemas.ts`:
  Organization, WebSite (+ SearchAction), Service, FAQ, Breadcrumb, provider profiles
  (`HomeAndConstructionBusiness` w/ ratings, reviews, offers), **blog posts (`BlogPosting`)**, and
  **eco-store (`ItemList` of `Product`)**.
- **`public/llms.txt`** — AI-discovery summary incl. browse, pricing, sustainability, eco-store, blog.
- **`app/sitemap.ts`** — static pages + all approved provider profiles + **published blog posts** +
  eco-store; `app/robots.ts` points to it.
- **Server-rendered (RSC)** public pages → crawlers get full HTML, no JS execution required.
- **i18n** — 8 locales with hreflang + self-canonical alternates.

---

## ▢ Off-code — DO THESE (this is what actually drives AI visibility)

### 1. Get indexed (do first — without this nothing else matters)
- [ ] **Google Search Console** — verify `https://xn--dorix-fsa.com` (DNS TXT or the existing meta).
      Submit `sitemap.xml`. Request indexing for the homepage + top pages.
- [ ] **Bing Webmaster Tools** — verify + submit the sitemap. **This powers ChatGPT search**, so it's
      as important as Google. (You can import settings straight from Search Console.)
- [ ] Confirm pages are getting indexed (GSC "Pages" report, `site:xn--dorix-fsa.com` on Google/Bing).

### 2. Build authority & citations (what makes AI *choose* DORIXÉ)
AI engines cite sources they trust. A new domain starts at ~zero authority. Earn it:
- [ ] List the business in directories: Google Business Profile, Trustpilot, local/EU cleaning
      directories, eco/green business directories.
- [ ] Get backlinks: guest posts, partnerships with eco brands (tie in the Eco-store affiliates),
      press/launch coverage, supplier/partner pages.
- [ ] Encourage real reviews (on-platform reviews already feed `aggregateRating` JSON-LD; also
      Trustpilot/Google).
- [ ] Social presence + consistent NAP (name/address/phone) across the web.

### 3. Publish content that answers real questions (the AI-citation engine)
AI answers quote pages that *directly answer a question*. Use the blog for this:
- [ ] Target question-style queries: "how much does eco cleaning cost in [city]", "are eco cleaning
      products effective", "how to start a cleaning business", "deep clean vs regular clean".
- [ ] Lead each post with a concise, quotable answer (first 1–2 sentences), then detail.
- [ ] Add an FAQ block to key pages (pricing, how-it-works, become-a-cleaner) — already wired for
      `FAQPage` JSON-LD; just supply the Q&A.

### 4. Measure
- [ ] In GSC, watch impressions/clicks per query + which pages rank.
- [ ] Periodically *ask the AI tools directly* ("recommend eco-friendly cleaning services in [city]",
      "best eco cleaning products") and see whether DORIXÉ is cited; iterate content toward the gaps.

---

## Realistic timeline
Indexing: days–weeks after GSC/Bing submission. Authority + AI citations: weeks–months, and it
compounds with content + backlinks. There is **no on-page trick** that bypasses indexing + authority —
the code makes us *eligible and machine-readable*; the off-code work makes us *chosen*.
