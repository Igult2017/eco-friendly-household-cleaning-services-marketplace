export type ResponseTimeBucket = "under1h" | "under3h" | "sameDay" | "within2days" | "slower"

// Bucketed rather than shown as an exact figure — "responds within a few hours" reads naturally,
// "avg 187.4 min" doesn't, and exact minutes on a small sample count is false precision anyway.
export function responseTimeBucket(minutes: number): ResponseTimeBucket {
  if (minutes < 60) return "under1h"
  if (minutes < 180) return "under3h"
  if (minutes < 24 * 60) return "sameDay"
  if (minutes < 2 * 24 * 60) return "within2days"
  return "slower"
}
