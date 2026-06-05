export type EcoLevel = "basic" | "certified" | "premium" | "zero_impact"

export const ECO_LEVEL_CONFIG: Record<
  EcoLevel,
  { label: string; color: string; minScore: number; description: string }
> = {
  basic: {
    label: "Eco Basic",
    color: "#6B7280",
    minScore: 0,
    description: "Uses some eco-friendly practices",
  },
  certified: {
    label: "Eco Certified",
    color: "#4CB87A",
    minScore: 40,
    description: "Certified eco-friendly products and practices",
  },
  premium: {
    label: "Eco Premium",
    color: "#2D7A5F",
    minScore: 70,
    description: "Exclusively plant-based, zero single-use plastics",
  },
  zero_impact: {
    label: "Zero Impact",
    color: "#1A5C45",
    minScore: 90,
    description: "Carbon-neutral, fully circular cleaning practices",
  },
}

/** Derive eco level from a 0–100 score */
export function scoreToEcoLevel(score: number): EcoLevel {
  if (score >= 90) return "zero_impact"
  if (score >= 70) return "premium"
  if (score >= 40) return "certified"
  return "basic"
}

/**
 * Calculate eco score from provider attributes.
 * Score: 0–100 across four pillars (25 pts each).
 */
export function calculateEcoScore(attrs: {
  certificationCount: number     // each cert = 5 pts, max 25
  plantBasedProductPct: number   // 0–100 → maps to 0–25 pts
  reusableSuppliesPct: number    // 0–100 → maps to 0–25 pts
  localTravelMode: "car" | "transit" | "bike" | "walk" // walk=25, bike=20, transit=10, car=0
}): number {
  const certPts = Math.min(attrs.certificationCount * 5, 25)
  const productPts = Math.round((attrs.plantBasedProductPct / 100) * 25)
  const supplyPts = Math.round((attrs.reusableSuppliesPct / 100) * 25)
  const travelPts =
    attrs.localTravelMode === "walk"
      ? 25
      : attrs.localTravelMode === "bike"
        ? 20
        : attrs.localTravelMode === "transit"
          ? 10
          : 0
  return certPts + productPts + supplyPts + travelPts
}
