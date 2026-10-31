/**
 * What a cleaning costs before discounts, commission and add-ons.
 *
 * ONE definition, used by every path that prices a job, because the alternative was proved
 * expensive: repeat cleanings kept their own copy of this sum and it simply took the hourly rate as
 * the whole price. A client booking three hours a week at €20/hr was charged €20 and the cleaner
 * was paid for one hour — every week, silently (bookings BK-2026-000010 to 000013, and 000015).
 *
 * If this ever needs to change, it changes here and every path moves together.
 */

/** Two hours, used when a repeat schedule predates us storing how long it runs for. */
export const DEFAULT_DURATION_MINUTES = 120

export type ServicePricing = {
  /** The cleaner's price in cents — per hour or for the whole job, per priceUnit. */
  basePrice: number
  /** "per_hour" multiplies by the hours booked; anything else is a flat whole-job price. */
  priceUnit: string | null
  durationMinutes: number
}

/** The job's base price in cents. */
export function priceForService({ basePrice, priceUnit, durationMinutes }: ServicePricing): number {
  if (priceUnit !== "per_hour") return basePrice
  return Math.round((basePrice * durationMinutes) / 60)
}

/**
 * The same sum, with its workings — so a charge can be explained rather than just asserted.
 * `expected` is what the arithmetic says; the caller passes what was actually charged, and any
 * gap is reported rather than quietly accepted.
 */
export function explainPrice(params: ServicePricing & {
  chargedCents: number
  /** "schedule" = the real booked duration. "fallback" = assumed, and worth an admin's attention. */
  durationSource: "schedule" | "fallback"
  /** The platform's cut in cents, and the percentage it was taken at. */
  commissionCents?: number
  commissionPct?: number
  /** What actually reaches the cleaner, after the cut. */
  payoutCents?: number
}): {
  rate: number
  unit: string
  minutes: number
  durationSource: string
  expected: number
  charged: number
  mismatch: number
  commission: number
  commissionPct: number
  payout: number
  summary: string
} {
  const expected = priceForService(params)
  const hours = params.durationMinutes / 60
  const money = (cents: number) => (cents / 100).toFixed(2)

  const base =
    params.priceUnit === "per_hour"
      ? `${money(params.basePrice)}/hr × ${hours.toFixed(1)} hrs = ${money(expected)} — charged ${money(params.chargedCents)}`
      : `${money(params.basePrice)} for the job — charged ${money(params.chargedCents)}`

  // The split belongs in the same sentence. "Why was I charged that?" and "why was I paid that?"
  // are one sum read from either end, and showing only half of it invites the other question.
  const split =
    params.payoutCents != null
      ? ` · commission ${money(params.commissionCents ?? 0)}${params.commissionPct != null ? ` (${params.commissionPct}%)` : ""} · cleaner gets ${money(params.payoutCents)}`
      : ""

  return {
    rate: params.basePrice,
    unit: params.priceUnit ?? "per_job",
    minutes: params.durationMinutes,
    durationSource: params.durationSource,
    expected,
    charged: params.chargedCents,
    mismatch: params.chargedCents - expected,
    commission: params.commissionCents ?? 0,
    commissionPct: params.commissionPct ?? 0,
    payout: params.payoutCents ?? 0,
    summary: base + split,
  }
}
