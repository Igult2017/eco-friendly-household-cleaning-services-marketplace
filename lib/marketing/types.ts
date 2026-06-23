// Shared types for the AI email-marketing system.

export type CampaignType = "welcome" | "value" | "soft_sell" | "hard_sell" | "custom"

// A segment filter — produced by AI (suggestSegment) or set by the admin, resolved to users by the audience resolver.
export interface AudienceFilter {
  role?: "customer" | "provider" | "all"
  onlyConsented?: boolean // restrict to marketingConsent = true (always forced true for non-welcome sends)
  signedUpWithinDays?: number // created within the last N days
  signedUpMoreThanDays?: number // created more than N days ago (dormant)
  hasBooked?: boolean // customers with ≥1 booking
  noBookings?: boolean // customers with 0 bookings
  limit?: number // cap recipients (safety)
}

// A generated email — unique per recipient when personalization is on.
export interface EmailDraft {
  subject: string
  html: string
}

// Minimal recipient profile fed to the AI for personalization + targeting.
export interface RecipientProfile {
  firstName?: string | null
  role?: string
  signedUpDaysAgo?: number
  bookingCount?: number
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  welcome: "Welcome",
  value: "Value",
  soft_sell: "Soft sell",
  hard_sell: "Hard sell",
  custom: "Custom",
}
