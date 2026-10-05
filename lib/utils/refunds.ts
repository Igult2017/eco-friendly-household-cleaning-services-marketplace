import { getCancellationConfig, type CancellationConfig } from "@/lib/platform/settings"
import { isWaivedReason } from "./cancellationReasons"

export type CallerRole = "customer" | "provider"

// The reason categories live in their own import-free module: this file reaches the database for the
// admin's live settings, and the cancel screens are browser components, so importing them from here
// pulled the Postgres driver into the browser bundle. Re-exported for server-side callers.
export {
  CANCELLATION_REASON_CATEGORIES,
  WAIVED_REASONS,
  isWaivedReason,
  type CancellationReasonCategory,
} from "./cancellationReasons"

export type CancellationFeeResult = {
  refundPercent: number       // % of the service price refunded to the CLIENT
  feePercent: number          // % actually taken from the CLIENT's card (0 when the cleaner cancels)
  travelCompensationCents: number // flat comp on top of the fee, only on the "late" tier
  cancellerFeePercent: number // % the person who CANCELLED is liable for, whichever side they are
}

/**
 * Admin-configurable 4-tier cancellation fee (percent of the service price retained), read live
 * from platform_settings — an admin change takes effect on the very next cancellation.
 *
 * Two different numbers come out of this, and conflating them is a money bug waiting to happen:
 *
 *  - `feePercent` is what is taken from the CLIENT's card. When a CLEANER cancels this is always 0
 *    and the client is refunded in full — a client is never charged for someone else's cancellation.
 *  - `cancellerFeePercent` is what whoever cancelled is liable for. Both sides are on the same
 *    ladder: a cleaner dropping a job the day before costs the client their day just as much.
 *
 * The fee is a reasonable pre-estimate of the other party's lost-slot loss, not a penalty — see
 * terms.ts Section 9 and the dispute process for a way to show the actual loss was lower.
 */
export function calculateCancellationFee(
  hoursUntilJob: number,
  callerRole: CallerRole,
  cfg: CancellationConfig,
  reasonCategory?: string | null,
): CancellationFeeResult {
  const free = { refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: 0 }

  // Unavoidable circumstances waive the fee entirely, for either side, at any notice.
  if (isWaivedReason(reasonCategory)) return free

  const ladder = (): { pct: number; travel: number } => {
    if (hoursUntilJob > cfg.tier1Hours) return { pct: 0, travel: 0 }
    if (hoursUntilJob > cfg.tier2Hours) return { pct: cfg.feeLowPct, travel: 0 }
    if (hoursUntilJob > cfg.tier3Hours) return { pct: cfg.feeMediumPct, travel: 0 }
    return { pct: cfg.feeLatePct, travel: cfg.travelCompCents }
  }
  const { pct, travel } = ladder()

  if (callerRole === "provider") {
    // Client is made whole; the cleaner carries the liability instead. Nothing is taken from the
    // client's card, so there is no travel compensation to pay out of it either.
    return { refundPercent: 100, feePercent: 0, travelCompensationCents: 0, cancellerFeePercent: pct }
  }
  return { refundPercent: 100 - pct, feePercent: pct, travelCompensationCents: travel, cancellerFeePercent: pct }
}

/** Convenience wrapper that reads the current config — use when the caller doesn't already have it. */
export async function calculateCancellationFeeLive(
  hoursUntilJob: number,
  callerRole: CallerRole,
  reasonCategory?: string | null,
): Promise<CancellationFeeResult> {
  const cfg = await getCancellationConfig()
  return calculateCancellationFee(hoursUntilJob, callerRole, cfg, reasonCategory)
}

// Back-compat named export for any caller that only wants the refund percent (no travel comp).
export function calculateRefundPercent(hoursUntilJob: number, callerRole: CallerRole, cfg: CancellationConfig): number {
  return calculateCancellationFee(hoursUntilJob, callerRole, cfg).refundPercent
}
