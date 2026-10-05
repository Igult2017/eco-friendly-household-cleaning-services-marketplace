// Pure, shared-by-both-sides facts about WHY a booking was cancelled.
//
// This file deliberately imports NOTHING. The cancel screens are browser components, and the fee
// engine next door (lib/utils/refunds.ts) reaches the database for the admin's live settings — so
// importing these constants from there dragged the Postgres driver into the browser bundle. Keeping
// the pure data here means the client and the server can agree on the rule without the client
// pulling in the database.

/** The categories offered when cancelling. The first two waive the fee — see WAIVED_REASONS. */
export const CANCELLATION_REASON_CATEGORIES = ["illness", "transport", "other"] as const
export type CancellationReasonCategory = (typeof CANCELLATION_REASON_CATEGORIES)[number]

/**
 * Circumstances nobody can plan around, so no fee is charged however late the cancellation is:
 * illness, and strikes / transport failure. Agreed policy, and it matches the "Hardship and force
 * majeure" waiver already written into Section 9 of the Terms.
 */
export const WAIVED_REASONS: readonly CancellationReasonCategory[] = ["illness", "transport"]

export function isWaivedReason(category?: string | null): boolean {
  return !!category && (WAIVED_REASONS as readonly string[]).includes(category)
}
