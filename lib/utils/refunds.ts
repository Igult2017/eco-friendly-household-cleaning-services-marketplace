export type CallerRole = "customer" | "provider"

export function calculateRefundPercent(hoursUntilJob: number, callerRole: CallerRole): number {
  if (callerRole === "provider") return 100
  if (hoursUntilJob > 48) return 100
  if (hoursUntilJob > 24) return 50
  return 0
}

export function calculateRefundAmount(totalAmount: number, hoursUntilJob: number, callerRole: CallerRole): number {
  const pct = calculateRefundPercent(hoursUntilJob, callerRole)
  return Math.round(totalAmount * (pct / 100))
}
