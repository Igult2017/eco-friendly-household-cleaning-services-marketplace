// Shared by both roles' "open a dispute" pages and anywhere a dispute's reason needs to be
// displayed back — one list, not a separate one per role. `labelKey` resolves against either
// customerBookingsIdDisputePage or providerBookingsIdDisputePage, which carry the same key names.
export const DISPUTE_REASONS = [
  { value: "service_not_performed", labelKey: "reasonServiceNotPerformed" },
  { value: "poor_quality", labelKey: "reasonPoorQuality" },
  { value: "no_show", labelKey: "reasonNoShow" },
  { value: "property_damage", labelKey: "reasonPropertyDamage" },
  { value: "wrong_price", labelKey: "reasonWrongPrice" },
  { value: "eco_non_compliance", labelKey: "reasonEcoNonCompliance" },
  { value: "scheduling_disagreement", labelKey: "reasonSchedulingDisagreement" },
  { value: "other", labelKey: "reasonOther" },
] as const

export function disputeReasonLabelKey(value: string): string {
  return DISPUTE_REASONS.find((r) => r.value === value)?.labelKey ?? "reasonOther"
}
