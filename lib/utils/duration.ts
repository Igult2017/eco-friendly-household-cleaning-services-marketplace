/**
 * Hours for people, minutes for the database.
 *
 * Durations are STORED in minutes because they have to be — an hour and a half is 90 minutes and
 * nothing else expresses that cleanly. But nobody books "120 minutes" of cleaning, they book two
 * hours. Clients were already offered hours; cleaners were left typing minutes into a box labelled
 * "(mins)", which is the kind of detail that turns into a pricing mistake, since a bid is a rate
 * multiplied by exactly this number.
 *
 * One place does the conversion so no screen has to think about it.
 */

/** The shortest and longest a job may be, mirroring the server's own limits. */
export const MIN_DURATION_MINUTES = 30
export const MAX_DURATION_MINUTES = 480

export type DurationOption = { minutes: number; label: string }

/**
 * The choices to show, in half-hour steps.
 *
 * Half hours because real cleans are not all whole hours, and because every option produced here is
 * a value the server already accepts — so a duration can no longer be rejected for being typed in
 * the wrong unit.
 */
export function durationOptions(
  minMinutes: number = MIN_DURATION_MINUTES,
  maxMinutes: number = MAX_DURATION_MINUTES,
): DurationOption[] {
  const lo = Math.max(MIN_DURATION_MINUTES, roundToHalfHour(minMinutes))
  const hi = Math.min(MAX_DURATION_MINUTES, roundToHalfHour(maxMinutes))
  const out: DurationOption[] = []
  for (let m = lo; m <= Math.max(lo, hi); m += 30) out.push({ minutes: m, label: formatHours(m) })
  return out
}

/** "30 min", "1 hour", "1½ hours", "2 hours" — what a person would actually say. */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const whole = Math.floor(minutes / 60)
  const half = minutes % 60 >= 30
  const unit = whole === 1 && !half ? "hour" : "hours"
  return `${whole}${half ? "½" : ""} ${unit}`
}

/** Hours to the stored unit. 1.5 -> 90. */
export const hoursToMinutes = (hours: number): number => Math.round(hours * 60)

/** The stored unit back to hours, for anything that needs the number rather than the words. */
export const minutesToHours = (minutes: number): number => minutes / 60

function roundToHalfHour(minutes: number): number {
  return Math.max(30, Math.round(minutes / 30) * 30)
}
