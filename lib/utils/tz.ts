const WEEKDAY_TO_NUM: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/**
 * Weekday (0=Sun..6=Sat) and "HH:MM" (24h) for a UTC instant, in a given IANA timezone.
 * The platform spans Europe + USA, so a booking's UTC time must be projected into the cleaner's
 * OWN timezone before comparing against their availability (day-of-week + working hours).
 */
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
