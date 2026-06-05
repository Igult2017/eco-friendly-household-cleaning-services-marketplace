// ── User Roles ────────────────────────────────────────────────
export type UserRole = "customer" | "provider" | "admin"

// ── Booking ───────────────────────────────────────────────────
export type BookingStatus =
  | "pending_payment"
  | "payment_authorized"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded"

export type BookingFrequency = "one_time" | "weekly" | "biweekly" | "monthly"

// ── Job / Bidding ─────────────────────────────────────────────
export type JobStatus = "open" | "bidding" | "assigned" | "completed" | "cancelled" | "expired"
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn"

// ── Payment ───────────────────────────────────────────────────
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "refunded"
  | "partially_refunded"
  | "failed"

export type PayoutStatus = "pending" | "processing" | "paid" | "failed"
export type PayoutSchedule = "weekly" | "biweekly" | "monthly"

// ── Disputes ──────────────────────────────────────────────────
export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved_customer"
  | "resolved_provider"
  | "escalated"
  | "closed"

// ── Provider ──────────────────────────────────────────────────
export type EcoLevel = "basic" | "certified" | "premium" | "zero_impact"
export type VerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "rejected"
  | "requires_resubmission"

// ── Address ───────────────────────────────────────────────────
export interface Address {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string // ISO 3166-1 alpha-2, e.g. "DE", "FR", "NL"
}

// ── Geo ───────────────────────────────────────────────────────
export interface Coordinates {
  latitude: number
  longitude: number
}

// ── API Responses ─────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T
  message?: string
}

export interface ApiError {
  error: string
  code?: string
}

// ── Booking Amounts ───────────────────────────────────────────
export interface BookingAmounts {
  subtotalCents: number      // provider's quoted price
  platformFeeCents: number   // 15% added on top
  totalChargedCents: number  // what customer pays
  providerPayoutCents: number // what provider receives
}

// ── Notification Types ────────────────────────────────────────
export type NotificationType =
  | "new_job_request"
  | "bid_received"
  | "bid_accepted"
  | "bid_rejected"
  | "booking_confirmed"
  | "booking_reminder"
  | "booking_completed"
  | "booking_cancelled"
  | "payment_received"
  | "payout_processed"
  | "dispute_opened"
  | "dispute_resolved"
  | "review_received"
  | "provider_approved"
  | "provider_suspended"
  | "identity_verified"

// ── Clerk session claims extended with role ────────────────────
export interface ClerkSessionClaims {
  metadata: {
    role?: UserRole
    onboardingComplete?: boolean
  }
}
