const WEEKDAY_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/**
 * Weekday (0=Sun..6=Sat) and "HH:MM" (24h) for a UTC instant, in a given IANA timezone.
 * The platform spans Europe + USA, so a booking's UTC time must be projected into the cleaner's
 * OWN timezone before comparing against their availability (day-of-week + working hours).
 */
/**
 * Inverse of zonedDayAndTime: given a local wall-clock date (YYYY-MM-DD) + time (HH:MM) and an IANA
 * timezone, return the UTC instant. Used so a booking's time is interpreted in the CLEANER's timezone
 * (where the job happens), not the client's browser timezone — the platform spans EU + US.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [h, m] = timeStr.split(":").map(Number)
  const guess = new Date(`${dateStr}T${timeStr}:00Z`)
  if (isNaN(guess.getTime())) return new Date(`${dateStr}T${timeStr}:00`)
  // What wall-clock does this UTC instant read in the target tz? Shift by the difference so it reads
  // exactly the requested local time there.
  const tzTime = guess.toLocaleString("sv-SE", { timeZone }).split(" ")[1] ?? "00:00:00"
  const [tzH, tzM] = tzTime.split(":").map(Number)
  const driftMin = (h * 60 + m) - (tzH * 60 + tzM)
  return new Date(guess.getTime() + driftMin * 60_000)
}

export function zonedDayAndTime(date: Date, timeZone: string): { dayOfWeek: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const dayOfWeek = WEEKDAY_TO_NUM[get("weekday")] ?? date.getUTCDay()
  const hour = (get("hour") || "00").padStart(2, "0")
  const minute = (get("minute") || "00").padStart(2, "0")
  // hourCycle "h23" can emit "24" at midnight on some engines — normalize to "00".
  const hh = hour === "24" ? "00" : hour
  return { dayOfWeek, hhmm: `${hh}:${minute}` }
}
