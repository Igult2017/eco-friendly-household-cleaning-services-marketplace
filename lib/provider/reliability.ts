export type ReliabilityStats = {
  completed: number
  cancelledByProvider: number
  averageRating: number | null
  totalReviews: number
}

export type ReliabilityTier = "new" | "reliable" | "high" | "top"
export type Reliability = { score: number; tier: ReliabilityTier }

/**
 * Composite reliability score (0–100): rating (60%) + completion rate (40%, i.e. how rarely the
 * cleaner cancels their own confirmed jobs). Cleaners with too little history are "new" — no score
 * is shown until they have a track record, so a single early review can't crown or sink them.
 */
export function computeReliability(s: ReliabilityStats): Reliability {
  if (s.completed < 3 && s.totalReviews < 1) return { score: 0, tier: "new" }
  const ratingScore = s.averageRating != null ? (Number(s.averageRating) / 5) * 100 : 75
  const totalOwn = s.completed + s.cancelledByProvider
  const completionRate = totalOwn > 0 ? (s.completed / totalOwn) * 100 : 100
  const score = Math.round(ratingScore * 0.6 + completionRate * 0.4)
  const tier: ReliabilityTier = score >= 90 ? "top" : score >= 78 ? "high" : score >= 55 ? "reliable" : "new"
  return { score, tier }
}

export const TIER_CLASS: Record<ReliabilityTier, string> = {
  new: "bg-gray-100 text-gray-600",
  reliable: "bg-blue-100 text-blue-700",
  high: "bg-emerald-100 text-emerald-700",
  top: "bg-amber-100 text-amber-700",
}
