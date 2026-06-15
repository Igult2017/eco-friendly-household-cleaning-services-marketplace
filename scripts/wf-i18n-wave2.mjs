export const meta = {
  name: "i18n-wave2-app",
  description: "i18n sweep: extract + translate strings into 8 locales and wire next-intl (wave2-app)",
  phases: [{ title: 'Translate', detail: 'one agent per file' }],
}

const LOCALES = ['en','de','fr','es','it','nl','pl','pt']
const FILES = [{"path":"app/(auth)/onboarding/layout.tsx","ns":"authOnboardingLayout"},{"path":"app/(auth)/onboarding/OnboardingForm.tsx","ns":"authOnboardingOnboardingForm"},{"path":"app/(auth)/onboarding/page.tsx","ns":"authOnboardingPage"},{"path":"app/(auth)/onboarding/ProviderFields.tsx","ns":"authOnboardingProviderFields"},{"path":"app/(customer)/book/confirm/page.tsx","ns":"customerBookConfirmPage"},{"path":"app/(customer)/book/extras/page.tsx","ns":"customerBookExtrasPage"},{"path":"app/(customer)/book/page.tsx","ns":"customerBookPage"},{"path":"app/(customer)/book/providers/page.tsx","ns":"customerBookProvidersPage"},{"path":"app/(customer)/book/schedule/page.tsx","ns":"customerBookSchedulePage"},{"path":"app/(customer)/bookings/[id]/cancel/page.tsx","ns":"customerBookingsIdCancelPage"},{"path":"app/(customer)/bookings/[id]/dispute/page.tsx","ns":"customerBookingsIdDisputePage"},{"path":"app/(customer)/bookings/[id]/messages/page.tsx","ns":"customerBookingsIdMessagesPage"},{"path":"app/(customer)/bookings/[id]/page.tsx","ns":"customerBookingsIdPage"},{"path":"app/(customer)/bookings/[id]/reschedule/page.tsx","ns":"customerBookingsIdReschedulePage"},{"path":"app/(customer)/bookings/[id]/review/page.tsx","ns":"customerBookingsIdReviewPage"},{"path":"app/(customer)/dashboard/page.tsx","ns":"customerDashboardPage"},{"path":"app/(customer)/jobs/page.tsx","ns":"customerJobsPage"},{"path":"app/(customer)/layout.tsx","ns":"customerLayout"},{"path":"app/(customer)/notifications/page.tsx","ns":"customerNotificationsPage"},{"path":"app/(customer)/payments/page.tsx","ns":"customerPaymentsPage"},{"path":"app/(customer)/post-job/page.tsx","ns":"customerPostjobPage"},{"path":"app/(customer)/profile/page.tsx","ns":"customerProfilePage"},{"path":"app/(customer)/recurring/page.tsx","ns":"customerRecurringPage"},{"path":"app/(provider)/bookings/[id]/complete/page.tsx","ns":"providerBookingsIdCompletePage"},{"path":"app/(provider)/layout.tsx","ns":"providerLayout"},{"path":"app/(provider)/provider/bookings/page.tsx","ns":"providerProviderBookingsPage"},{"path":"app/(provider)/provider/bookings/[id]/complete/page.tsx","ns":"providerProviderBookingsIdCompletePage"},{"path":"app/(provider)/provider/bookings/[id]/messages/page.tsx","ns":"providerProviderBookingsIdMessagesPage"},{"path":"app/(provider)/provider/dashboard/page.tsx","ns":"providerProviderDashboardPage"},{"path":"app/(provider)/provider/earnings/page.tsx","ns":"providerProviderEarningsPage"},{"path":"app/(provider)/provider/jobs/page.tsx","ns":"providerProviderJobsPage"},{"path":"app/(provider)/provider/notifications/page.tsx","ns":"providerProviderNotificationsPage"},{"path":"app/(provider)/provider/profile/eco-certifications/page.tsx","ns":"providerProviderProfileEcocertificationsPage"},{"path":"app/(provider)/provider/profile/page.tsx","ns":"providerProviderProfilePage"},{"path":"app/(provider)/provider/profile/services/page.tsx","ns":"providerProviderProfileServicesPage"},{"path":"app/(provider)/reviews/page.tsx","ns":"providerReviewsPage"},{"path":"app/(provider)/schedule/page.tsx","ns":"providerSchedulePage"},{"path":"app/global-error.tsx","ns":"globalerror"},{"path":"components/bidding/AcceptBidButton.tsx","ns":"compBiddingAcceptBidButton"},{"path":"components/blog/BlogComments.tsx","ns":"compBlogBlogComments"},{"path":"components/blog/BlogContent.tsx","ns":"compBlogBlogContent"},{"path":"components/blog/BlogEditor.tsx","ns":"compBlogBlogEditor"},{"path":"components/blog/BlogEditorToolbar.tsx","ns":"compBlogBlogEditorToolbar"},{"path":"components/blog/BlogPostCard.tsx","ns":"compBlogBlogPostCard"},{"path":"components/blog/ShareButtons.tsx","ns":"compBlogShareButtons"},{"path":"components/booking/BeforePhotoUpload.tsx","ns":"compBookingBeforePhotoUpload"},{"path":"components/booking/ProviderBookingActions.tsx","ns":"compBookingProviderBookingActions"},{"path":"components/booking/ProviderCard.tsx","ns":"compBookingProviderCard"},{"path":"components/booking/RecurringScheduleCard.tsx","ns":"compBookingRecurringScheduleCard"},{"path":"components/booking/RecurringToggle.tsx","ns":"compBookingRecurringToggle"},{"path":"components/booking/RescheduleForm.tsx","ns":"compBookingRescheduleForm"},{"path":"components/booking/RescheduleModal.tsx","ns":"compBookingRescheduleModal"},{"path":"components/booking/StripePaymentForm.tsx","ns":"compBookingStripePaymentForm"},{"path":"components/booking/WizardProgress.tsx","ns":"compBookingWizardProgress"},{"path":"components/customer/DashboardActions.tsx","ns":"compCustomerDashboardActions"},{"path":"components/customer/DashboardBookings.tsx","ns":"compCustomerDashboardBookings"},{"path":"components/customer/DashboardJobs.tsx","ns":"compCustomerDashboardJobs"},{"path":"components/customer/DashboardNotifications.tsx","ns":"compCustomerDashboardNotifications"},{"path":"components/customer/DashboardPayments.tsx","ns":"compCustomerDashboardPayments"},{"path":"components/gdpr/CookieBanner.tsx","ns":"compGdprCookieBanner"},{"path":"components/layout/AddCleanerRoleForm.tsx","ns":"compLayoutAddCleanerRoleForm"},{"path":"components/layout/AdminCleanerSwitch.tsx","ns":"compLayoutAdminCleanerSwitch"},{"path":"components/layout/EnableCustomerRoleButton.tsx","ns":"compLayoutEnableCustomerRoleButton"},{"path":"components/layout/RoleSwitcher.tsx","ns":"compLayoutRoleSwitcher"},{"path":"components/layout/SwitchNotifier.tsx","ns":"compLayoutSwitchNotifier"},{"path":"components/location/LocationDetectButton.tsx","ns":"compLocationLocationDetectButton"},{"path":"components/messaging/MessageThread.tsx","ns":"compMessagingMessageThread"},{"path":"components/notifications/MarkAllReadButton.tsx","ns":"compNotificationsMarkAllReadButton"},{"path":"components/notifications/NotificationBell.tsx","ns":"compNotificationsNotificationBell"},{"path":"components/onboarding/BusinessDetailsForm.tsx","ns":"compOnboardingBusinessDetailsForm"},{"path":"components/onboarding/ProviderIdentityStep.tsx","ns":"compOnboardingProviderIdentityStep"},{"path":"components/onboarding/ProviderPayoutStep.tsx","ns":"compOnboardingProviderPayoutStep"},{"path":"components/onboarding/StepIndicator.tsx","ns":"compOnboardingStepIndicator"},{"path":"components/provider/ProviderDashboardBids.tsx","ns":"compProviderProviderDashboardBids"},{"path":"components/provider/ProviderDashboardDisputes.tsx","ns":"compProviderProviderDashboardDisputes"},{"path":"components/provider/ProviderDashboardEarnings.tsx","ns":"compProviderProviderDashboardEarnings"},{"path":"components/provider/ProviderDashboardNearbyJobs.tsx","ns":"compProviderProviderDashboardNearbyJobs"},{"path":"components/provider/ProviderDashboardNotifications.tsx","ns":"compProviderProviderDashboardNotifications"},{"path":"components/provider/ProviderDashboardRating.tsx","ns":"compProviderProviderDashboardRating"},{"path":"components/provider/ProviderDashboardSchedule.tsx","ns":"compProviderProviderDashboardSchedule"},{"path":"components/providers/QueryProvider.tsx","ns":"compProvidersQueryProvider"},{"path":"components/referral/ReferralCard.tsx","ns":"compReferralReferralCard"},{"path":"components/ui/avatar.tsx","ns":"compUiAvatar"},{"path":"components/ui/badge.tsx","ns":"compUiBadge"},{"path":"components/ui/button.tsx","ns":"compUiButton"},{"path":"components/ui/card.tsx","ns":"compUiCard"},{"path":"components/ui/chart.tsx","ns":"compUiChart"},{"path":"components/ui/dialog.tsx","ns":"compUiDialog"},{"path":"components/ui/dropdown-menu.tsx","ns":"compUiDropdownmenu"},{"path":"components/ui/input.tsx","ns":"compUiInput"},{"path":"components/ui/label.tsx","ns":"compUiLabel"},{"path":"components/ui/LanguagePopup.tsx","ns":"compUiLanguagePopup"},{"path":"components/ui/navigation-menu.tsx","ns":"compUiNavigationmenu"},{"path":"components/ui/scroll-area.tsx","ns":"compUiScrollarea"},{"path":"components/ui/select.tsx","ns":"compUiSelect"},{"path":"components/ui/separator.tsx","ns":"compUiSeparator"},{"path":"components/ui/sheet.tsx","ns":"compUiSheet"},{"path":"components/ui/skeleton.tsx","ns":"compUiSkeleton"},{"path":"components/ui/slider.tsx","ns":"compUiSlider"},{"path":"components/ui/sonner.tsx","ns":"compUiSonner"},{"path":"components/ui/switch.tsx","ns":"compUiSwitch"},{"path":"components/ui/table.tsx","ns":"compUiTable"},{"path":"components/ui/tabs.tsx","ns":"compUiTabs"},{"path":"components/ui/textarea.tsx","ns":"compUiTextarea"}]

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
log('wave2-app done: translated ' + translated + ', skipped ' + skipped)
return { merged, summary }
