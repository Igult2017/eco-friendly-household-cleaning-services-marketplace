export const meta = {
  name: "i18n-wave3-admin",
  description: "i18n sweep: extract + translate strings into 8 locales and wire next-intl (wave3-admin)",
  phases: [{ title: 'Translate', detail: 'one agent per file' }],
}

const LOCALES = ['en','de','fr','es','it','nl','pl','pt']
const FILES = [{"path":"app/(admin)/admin/analytics/page.tsx","ns":"adminAdminAnalyticsPage"},{"path":"app/(admin)/admin/bookings/page.tsx","ns":"adminAdminBookingsPage"},{"path":"app/(admin)/admin/content/blog/new/page.tsx","ns":"adminAdminContentBlogNewPage"},{"path":"app/(admin)/admin/content/blog/page.tsx","ns":"adminAdminContentBlogPage"},{"path":"app/(admin)/admin/content/blog/[id]/edit/page.tsx","ns":"adminAdminContentBlogIdEditPage"},{"path":"app/(admin)/admin/customers/page.tsx","ns":"adminAdminCustomersPage"},{"path":"app/(admin)/admin/dashboard/page.tsx","ns":"adminAdminDashboardPage"},{"path":"app/(admin)/admin/disputes/page.tsx","ns":"adminAdminDisputesPage"},{"path":"app/(admin)/admin/eco/page.tsx","ns":"adminAdminEcoPage"},{"path":"app/(admin)/admin/error.tsx","ns":"adminAdminError"},{"path":"app/(admin)/admin/errors/page.tsx","ns":"adminAdminErrorsPage"},{"path":"app/(admin)/admin/payments/page.tsx","ns":"adminAdminPaymentsPage"},{"path":"app/(admin)/admin/payouts/page.tsx","ns":"adminAdminPayoutsPage"},{"path":"app/(admin)/admin/promo-codes/page.tsx","ns":"adminAdminPromocodesPage"},{"path":"app/(admin)/admin/providers/page.tsx","ns":"adminAdminProvidersPage"},{"path":"app/(admin)/admin/referrals/page.tsx","ns":"adminAdminReferralsPage"},{"path":"app/(admin)/admin/reviews/page.tsx","ns":"adminAdminReviewsPage"},{"path":"app/(admin)/admin/settings/page.tsx","ns":"adminAdminSettingsPage"},{"path":"app/(admin)/admin/users/page.tsx","ns":"adminAdminUsersPage"},{"path":"app/(admin)/layout.tsx","ns":"adminLayout"},{"path":"components/admin/AdminSidebar.tsx","ns":"compAdminAdminSidebar"},{"path":"components/admin/analytics/CountryTable.tsx","ns":"compAdminAnalyticsCountryTable"},{"path":"components/admin/analytics/DayOfWeekBars.tsx","ns":"compAdminAnalyticsDayOfWeekBars"},{"path":"components/admin/analytics/PagesTable.tsx","ns":"compAdminAnalyticsPagesTable"},{"path":"components/admin/analytics/ReferrerTable.tsx","ns":"compAdminAnalyticsReferrerTable"},{"path":"components/admin/analytics/UmamiSetup.tsx","ns":"compAdminAnalyticsUmamiSetup"},{"path":"components/admin/blog/AdminBlogList.tsx","ns":"compAdminBlogAdminBlogList"},{"path":"components/admin/blog/BlogPostForm.tsx","ns":"compAdminBlogBlogPostForm"},{"path":"components/admin/ErrorResolveButton.tsx","ns":"compAdminErrorResolveButton"},{"path":"components/admin/KpiCard.tsx","ns":"compAdminKpiCard"},{"path":"components/admin/PromoCodeCreateForm.tsx","ns":"compAdminPromoCodeCreateForm"},{"path":"components/admin/PromoCodeTable.tsx","ns":"compAdminPromoCodeTable"},{"path":"components/admin/StatusBadge.tsx","ns":"compAdminStatusBadge"},{"path":"components/admin/SyncUsersButton.tsx","ns":"compAdminSyncUsersButton"},{"path":"components/admin/UserRoleManager.tsx","ns":"compAdminUserRoleManager"}]

const localeObj = { type: 'object', additionalProperties: { type: 'string' } }
const SCHEMA = {
  type: 'object',
  properties: {
    skipped: { type: 'boolean' },
    reason: { type: 'string' },
    messages: { type: 'object', properties: Object.fromEntries(LOCALES.map((l) => [l, localeObj])), required: LOCALES },
  },
  required: ['skipped','messages'],
}

function agentPrompt(f) {
  return [
    'You are migrating ONE file to next-intl i18n in a Next.js 16 App Router project named DORIXÉ (an eco-friendly home-cleaning marketplace, EU market).',
    '',
    'FILE: ' + f.path,
    'NAMESPACE: "' + f.ns + '"',
    '',
    'next-intl is ALREADY configured (cookie-based, no URL prefix). NextIntlClientProvider wraps the whole app in the root layout. So:',
    '- CLIENT component (file STARTS with "use client"): add  import { useTranslations } from "next-intl"  and inside the component:  const t = useTranslations("' + f.ns + '")',
    '- SERVER component (no "use client"): add  import { getTranslations } from "next-intl/server"  and make the component async if needed, then:  const t = await getTranslations("' + f.ns + '")',
    '',
    'STEPS:',
    '1. Read ' + f.path + ' (only this file).',
    '2. Find EVERY user-facing string: visible JSX text, headings, paragraphs, button/link labels, input placeholders, aria-label, alt, title attributes, empty-state text, validation/toast/error messages shown to users, select option labels.',
    '3. Replace each with t("camelCaseKey") using clear FLAT keys (no nested objects, no dots). Dynamic values use ICU: t("greeting", { name }) with English "Hello {name}". Pluralization uses ICU plural syntax in the string.',
    '4. DO NOT translate or touch: className, href/src/URL, CSS, variable/function names, API params, enum/status string values used in logic, console.* logs, data-* attributes, the brand name "DORIXÉ", or anything not shown to end users. Be careful: if a string is BOTH a display label and a logic value, keep the logic value and only translate the displayed text.',
    '5. EDIT THE FILE IN PLACE (Edit/Write). Keep ALL logic, imports, props, and formatting intact. Ensure it still compiles (valid TSX, correct async/await, balanced braces). If a client component already has hooks, add useTranslations at the top with the others.',
    '6. Provide translations for ALL introduced keys in ALL 8 locales: en (exact original), de, fr, es, it, nl, pl, pt. Natural, native, idiomatic for an eco home-cleaning marketplace. Keep ICU placeholders identical across locales. Keep "DORIXÉ" unchanged.',
    '',
    'If the file has NO user-facing text (pure layout/wiring/logic/icons), make NO edits, set skipped=true, return empty objects for every locale.',
    '',
    'CRITICAL: every locale object MUST have the SAME key set as en. Return only the structured output.',
  ].join('\n')
}

phase('Translate')
const results = await pipeline(
  FILES,
  (f) => agent(agentPrompt(f), { label: 'i18n:' + f.ns, phase: 'Translate', schema: SCHEMA, agentType: 'general-purpose' })
    .then((r) => (r ? { ...r, ns: f.ns, path: f.path } : { skipped: true, ns: f.ns, path: f.path, messages: {} }))
)

const merged = {}
for (const l of LOCALES) merged[l] = {}
let translated = 0, skipped = 0
const summary = []
for (const r of results) {
  if (!r || r.skipped) { skipped++; if (r) summary.push({ path: r.path, ns: r.ns, skipped: true }); continue }
  translated++
  for (const l of LOCALES) merged[l][r.ns] = (r.messages && r.messages[l]) || {}
  summary.push({ path: r.path, ns: r.ns, skipped: false, keys: r.messages && r.messages.en ? Object.keys(r.messages.en).length : 0 })
}
log('wave3-admin done: translated ' + translated + ', skipped ' + skipped)
return { merged, summary }
