# DORIXÉ — Recommended Additional Legal Pages

> From the legal audit, 2026-06-28. Suggested pages/policies to add beyond Terms/Privacy/Cookie/Impressum.

I'll analyze the business context and findings to recommend the additional legal pages DORIXÉ should add. This is an analysis/recommendation task, so I'll synthesize directly from the provided material.

# Additional Legal Pages & Policies DORIXÉ Should Add

Beyond the existing **Terms / Privacy / Cookie / Impressum** (all of which need substantial rewrites per the findings), DORIXÉ should add the following standalone pages. They are ordered by enforcement risk and how much they reduce the exposure flagged in the findings.

---

## 1. Cleaner / Provider Agreement (separate from client-facing Terms)
**Why it matters:** The current Terms read as client-facing, yet cleaners are independent business users with completely different rights and obligations. A dedicated agreement is the single strongest defence against employment misclassification (CA ABC test/AB5, EU Platform Work Directive's rebuttable presumption, German *Scheinselbständigkeit*) and is required to satisfy the EU P2B Regulation.

- Independent-contractor relationship: cleaners control their own rates, schedule, tools, job acceptance, and may work for competitors; DORIXÉ provides a venue only and does not direct the manner of work
- Tax, social-contribution, licensing and lawful-operation self-responsibility
- **Insurance obligation:** cleaner must carry/maintain own liability insurance as a condition of listing; sole responsibility for property damage/injury
- Verification scope stated honestly: identity verification via Stripe Identity only; no criminal-background check, no insurance verification, no eco-certification by DORIXÉ
- P2B-mandated suspension/termination grounds, prior notice + statement of reasons, and internal complaint-handling (IDR)
- Ranking / bid-ranking main parameters and how the bidding marketplace works (P2B transparency)
- Payout mechanics: destination charges, manual-capture, commission deducted from payout, ~weekly payout, currency (EUR/USD)
- Tax-data collection for payouts: W-9/W-8 (US), DAC7 identity/TIN (EU), backup withholding
- No off-platform solicitation / no-circumvention; indemnity running from the cleaner to DORIXÉ
- Brand-use restrictions (no implying employment/agency; controlled use of marks)

---

## 2. US Privacy Notice (CCPA / CPRA + multi-state) — standalone `/legal/privacy-us`
**Why it matters:** The privacy policy is GDPR-only; operating a US-facing site with zero CCPA disclosure is a per-violation exposure ($2,500 / $7,500) and a top CA AG / CPPA trigger. CO/VA/CT/UT/OR/TX/MT require substantively the same notice.

- Notice at Collection: table of PI categories mapped to CCPA categories (identifiers, commercial info, geolocation, internet activity, **sensory data = home photos**, financial info), with purposes and retention
- **Sensitive PI** subsection: precise geolocation + home-interior photos; the "right to limit use of sensitive PI"; opt-in consent for VA/CO/CT
- Consumer rights: know, access, delete, correct, opt-out of sale/share, limit; non-discrimination statement
- **"Do Not Sell or Share My Personal Information"** + **"Limit the Use of My Sensitive PI"** links; Global Privacy Control (GPC) honored as a valid opt-out
- Request intake: two methods (email + webform), identity verification, authorized-agent process, **appeals process** (required by CO/VA/CT)
- Response timeline: 45 days, extendable to 90
- Accurate "we do not sell/share" representation reconciled with the cookie/analytics fix (must not contradict tracking tech)

---

## 3. Detailed Refund, Cancellation & Withdrawal Policy
**Why it matters:** This carries three **critical** findings at once — the missing EU 14-day right of withdrawal (cooling-off, which legally overrides the cancellation tiers), the likely-unfair UCTD cancellation penalties, and US auto-renewal law for recurring bookings.

- **EU Right of Withdrawal:** the 14-day cooling-off right, the statutory Model Withdrawal Form, and a withdrawal email/address
- Early-start mechanism: for bookings inside 14 days, the express-request checkbox + acknowledgement of pro-rated loss of the right (CRD arts. 7(3)/16(a)), persisted on the booking
- Cancellation tiers reframed as a **contractual** policy applying only after the withdrawal right lapses/is validly waived; fees tied to genuine pre-estimate of provider loss (not 100% forfeiture), with a hardship/force-majeure waiver carve-out
- Cleaner-cancellation = 100% refund; force-majeure cancellations = full refund (distinct from tiers)
- **Recurring bookings / auto-renewal:** clear-and-conspicuous disclosure of amount + frequency, distinct affirmative consent ("I authorize DORIXÉ to charge… until I cancel"), advance reminder before each charge, one-click online cancellation (FTC Click-to-Cancel + CA/NY/IL ARLs)
- Dispute/chargeback flow: how to raise a complaint, timeline, evidence used (incl. before/after photos), request to use internal process before a card dispute, carbon-offset included in full refund
- US state cancellation/cooling-off and UDAP-compliant refund disclosures

---

## 4. Affiliate / Referral Program Terms — standalone, linked from `/affiliate`
**Why it matters:** Registered users AND standalone influencers earn commission; under FTC Endorsement Guides, DORIXÉ is liable for its affiliates' undisclosed endorsements. The `/affiliate` page currently links only to generic Terms.

- Eligibility (incl. minimum age), commission rate, 30-day attribution window, payout thresholds/timing
- **Clawback** on refunded/cancelled bookings (reconcile against cancellation tiers)
- Prohibited conduct: self-referral, cookie stuffing, spam/unsolicited marketing, trademark bidding, domain registration
- **Mandatory FTC/UCPD disclosure duty:** affiliates must "clearly and conspicuously" disclose the material connection ("#ad"/"paid partner") in every promotion; CAN-SPAM compliance if they email
- Prohibition on repeating DORIXÉ's unsubstantiated claims (no inventing "background-checked"/"insured"/"eco" claims)
- Tax: W-9/W-8 (US, $600+ → 1099-NEC), DAC7 (EU), backup withholding
- DORIXÉ's audit, claw-back and termination rights; narrow brand-use licence
- Eco-store note: third-party products sold by the third party, not DORIXÉ; affiliate-disclosure string rendered above the product grid

---

## 5. Acceptable Use Policy
**Why it matters:** Concentrates conduct rules in one referenceable place and gives DORIXÉ clean footing to suspend/remove users — needed for both DSA (EU) and platform integrity.

- Prohibited conduct: fraud, harassment, off-platform circumvention, scraping, multiple/fake accounts
- **UGC rules** (cross-ref Trust & Safety): no capturing identifiable third parties or children in home photos; no uploading others' home photos; uploader must have necessary consents
- No unlawful, infringing, defamatory or privacy-violating content
- Anti-spam for messaging and reviews; no review manipulation (gating, fake/AI/incentivized reviews)
- Consequences: warning, content removal, suspension, termination (with P2B notice for cleaners)

---

## 6. Community / Review Guidelines + Trust & Safety / Complaints Policy
**Why it matters:** Two-way reviews are published personal data about identifiable people; the FTC Fake Reviews Rule (16 CFR 465, penalties ~$51,744/violation) and EU DSA both apply. Current Terms ban "false reviews" but give no mechanism.

- Legal basis for publishing reviews (legitimate interest in a trustworthy marketplace) + retention
- Reviews must be genuine, tied to a completed booking ("Verified booking"), no PII of third parties, no unlawful content
- **No review-gating, no compensated/AI/fake reviews, no suppression of honest negatives** (Part 465); incentivized-review flagging
- **Right of reply** for the reviewed person; objection/correction route
- **Notice-and-action / takedown** mechanism (DSA notice-and-action + US DMCA §512 with a designated agent)
- How dispute evidence (photos/messages) is used and retained; complaints escalation path and timelines

---

## 7. Sustainability / Green Claims Disclosure ("Our Eco Claims")
**Why it matters:** Eco messaging runs throughout plus a paid carbon-offset add-on — squarely in the EU Green Claims/EmpCo crackdown and FTC Green Guides scope. Includes a possibly-fictitious verifier ("Verified by EcoAudit EU").

- Define each eco tier (basic/certified/premium/zero_impact) with objective criteria; state clearly whether **self-declared** vs independently verified (stop using "certified"/"verified" for self-declared status)
- Drop "Verified by EcoAudit EU" unless a real, documented audit exists; avoid absolute "zero impact"/"carbon-neutral"/"non-toxic" without proof
- **Carbon-offset add-on:** voluntary/optional and not part of the cleaner's fee; offset provider/registry, project type, tCO2e per booking, methodology, how the contribution is used; refund behaviour (released if cancelled, included in full refund); VAT/tax treatment
- Alignment statement for FTC Green Guides (US) and substantiation kept on file

---

## 8. Subprocessor List (standalone, dated, maintained) — linked from Privacy
**Why it matters:** The current list names a vendor not used (Cloudflare R2) and omits five real ones — a transparency breach (GDPR Art. 13/30; FTC §5 deceptive omission) and the public face of the Art. 30 record.

- Accurate table: **Stripe** (payments), **Stripe Identity** (ID/biometric verification), **Clerk** (auth), **Resend** (email), **Backblaze B2** (file/photo storage — replaces Cloudflare R2), **Pusher** (realtime), **Inngest** (jobs), **Sentry** (error monitoring), **Umami** (analytics)
- Per processor: purpose, country of processing, and **transfer safeguard** (EU-US DPF certification / SCCs + supplementary measures)
- Commitment to give advance notice of new subprocessors; dated and version-controlled

---

## 9. Data Processing Addendum (DPA) for B2B / business clients
**Why it matters:** Office-cleaning means business clients (offices) whose own staff data may be processed; B2B customers will demand a controller-processor DPA, and it backstops the Art. 28 chain.

- Roles, processing scope, duration, nature/purpose, categories of data and data subjects
- Processor obligations: process only on documented instructions, confidentiality, Art. 32 security measures
- Sub-processor authorization + the maintained subprocessor list (cross-ref #8)
- International-transfer mechanism (SCCs/DPF), assistance with DSARs and breach notification, audit rights, deletion/return on termination
- Incorporate the 2021 SCCs; reference per-processor TIAs on file

---

## 10. Modern Slavery Statement + DSA Transparency Notice
**Why it matters:** As the platform scales and is "positioned globally," a Modern Slavery statement is a foreseeable threshold obligation (UK/AU-style); the DSA already imposes intermediary duties now.

- **DSA:** single point of contact, terms transparency, notice-and-action statistics, statement-of-reasons for content/account actions, internal complaint-handling (ties to #6 and the Cleaner Agreement)
- **Modern Slavery:** supply-chain and provider due-diligence statement, reporting channel, zero-tolerance policy ([[NEEDS: confirm turnover thresholds / entity to determine if statutorily required yet]])

---

## Cross-cutting placeholders every new page inherits
[[NEEDS: legal entity name + form]] · [[NEEDS: registered/principal address (EU + US)]] · [[NEEDS: commercial register court + HRB number]] · [[NEEDS: VAT/USt-ID or US EIN/state registration]] · [[NEEDS: DPO name/contact; Art. 27 EU representative]] · [[NEEDS: dedicated legal@ / privacy@ / DPO@ contact emails]] · [[NEEDS: US privacy contact + webform]] · [[NEEDS: DMCA designated agent + registration]] · [[NEEDS: chosen US governing-law state/venue + arbitration decision]] · [[NEEDS: carbon-offset provider/registry/methodology]] · [[NEEDS: whether any platform insurance exists]] · [[NEEDS: registered EUTM/USPTO trademark numbers]]

**Note on localisation:** all user-facing legal pages (not admin) must be available in the 8 supported EU locales — privacy/consent information must be in a language the data subject understands (CCPA reasonable-accessibility likewise).