import { setRequestLocale, getMessages } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { notFound } from "next/navigation"
import { routing } from "@/i18n/routing"
import { isLocale } from "@/i18n/config"

// Perf: NextIntlClientProvider serializes its messages into EVERY page's RSC payload. Server
// components use getTranslations (the full request config) and are unaffected by this — so we ship
// the client only the namespaces that a "use client" component actually consumes via useTranslations,
// not all ~110. This is the COMPLETE set of client namespaces across components/ (server-only/page
// namespaces are intentionally excluded), trimming ~55KB off every page's payload. If you add a new
// client component that calls useTranslations("X"), add "X" here.
const CLIENT_NAMESPACES = new Set<string>([
  "nav", "compGdprCookieBanner", "compUiDialog", "compUiSheet", "compUiLanguagePopup", "globalerror",
  "compLayoutAdminCleanerSwitch", "compLayoutRoleSwitcher", "compLayoutEnableCustomerRoleButton",
  "compLayoutAddCleanerRoleForm", "roleBadge", "approvalNotice",
  "compBookingProviderCard", "compLocationLocationDetectButton", "compReferralReferralCard",
  "compBlogShareButtons", "compBlogBlogComments", "compBlogBlogEditor", "compBlogBlogEditorToolbar",
  "compBookingProviderBookingActions", "compBookingBeforePhotoUpload", "compBookingRecurringScheduleCard",
  "compBookingRecurringToggle", "compBookingRescheduleForm", "compBookingRescheduleModal",
  "compBookingWizardProgress", "compBookingStripePaymentForm",
  "compOnboardingProviderPayoutStep", "compOnboardingProviderIdentityStep", "compOnboardingBusinessDetailsForm",
  "compNotificationsNotificationBell", "compNotificationsMarkAllReadButton",
  "compReviewsRateCustomer", "compProviderPricing", "compProviderAddons",
  "compMessagingMessageThread", "compBiddingAcceptBidButton",
  "browseJobs",
])
import { CookieBanner } from "@/components/gdpr/CookieBanner"
import { LocaleDetector } from "@/components/i18n/LocaleDetector"
import { HtmlLang } from "@/components/i18n/HtmlLang"

// Prerender one variant of every public page per locale (the switch that makes them static).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Locale subtree for PUBLIC pages. The locale comes from the URL segment (not cookies/headers),
// so setRequestLocale lets everything below render statically. Provides the intl context + the
// per-locale shell that used to live in the (now static) root layout.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const messages = await getMessages()
  const clientMessages = Object.fromEntries(
    Object.entries(messages).filter(([ns]) => CLIENT_NAMESPACES.has(ns)),
  )

  return (
    <NextIntlClientProvider locale={locale} messages={clientMessages}>
      <HtmlLang locale={locale} />
      {children}
      <CookieBanner />
      <LocaleDetector />
    </NextIntlClientProvider>
  )
}
