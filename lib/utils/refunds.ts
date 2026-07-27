import { getCancellationConfig, type CancellationConfig } from "@/lib/platform/settings"

export type CallerRole = "customer" | "provider"

export type CancellationFeeResult = {
  refundPercent: number       // % of the service price refunded to the client
  feePercent: number          // 100 - refundPercent
  travelCompensationCents: number // flat comp on top of the fee, only on the "late" tier
}

/**
 * Admin-configurable 4-tier cancellation fee (percent of the service price retained), read live
 * from platform_settings — an admin change takes effect on the very next cancellation. A provider
 * cancelling is always a full release (never a fee). Fee is intended as a reasonable pre-estimate
 * of the cleaner's lost-slot loss, not a penalty — see terms.ts Section 9 and the dispute process
 * for a client to show their actual loss was lower.
 */
export function calculateCancellationFee(hoursUntilJob: number, callerRole: CallerRole, cfg: CancellationConfig): CancellationFeeResult {
  if (callerRole === "provider") return { refundPercent: 100, feePercent: 0, travelCompensationCents: 0 }
  if (hoursUntilJob > cfg.tier1Hours) return { refundPercent: 100, feePercent: 0, travelCompensationCents: 0 }
  if (hoursUntilJob > cfg.tier2Hours) return { refundPercent: 100 - cfg.feeLowPct, feePercent: cfg.feeLowPct, travelCompensationCents: 0 }
  if (hoursUntilJob > cfg.tier3Hours) return { refundPercent: 100 - cfg.feeMediumPct, feePercent: cfg.feeMediumPct, travelCompensationCents: 0 }
  return { refundPercent: 100 - cfg.feeLatePct, feePercent: cfg.feeLatePct, travelCompensationCents: cfg.travelCompCents }
}

/** Convenience wrapper that reads the current config — use when the caller doesn't already have it. */
export async function calculateCancellationFeeLive(hoursUntilJob: number, callerRole: CallerRole): Promise<CancellationFeeResult> {
  const cfg = await getCancellationConfig()
  return calculateCancellationFee(hoursUntilJob, callerRole, cfg)
}

// Back-compat named export for any caller that only wants the refund percent (no travel comp).
export function calculateRefundPercent(hoursUntilJob: number, callerRole: CallerRole, cfg: CancellationConfig): number {
  return calculateCancellationFee(hoursUntilJob, callerRole, cfg).refundPercent
}
