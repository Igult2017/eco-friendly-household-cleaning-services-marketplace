/** Format a date for display: "Thursday, 5 June 2026" */
export function formatDate(date: Date | string, locale = "en-GB"): string {
  // Date-ONLY strings ("2026-07-10") parse as UTC midnight, so any negative-UTC browser (US) renders
  // the PREVIOUS day. Pin them to local noon — calendar dates have no timezone.
  const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00`) : new Date(date)
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Today's date as YYYY-MM-DD in the BROWSER's local timezone (for date-input `min` attributes —
 * toISOString() is UTC and blocks "today" for US users in the evening). */
export function localTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA")
}

/** Format date + time: "5 Jun 2026, 10:00" */
export function formatDateTime(date: Date | string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

/** Format relative time: "2 hours ago", "in 3 days" */
export function formatRelativeTime(date: Date | string, locale = "en-GB"): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const diffMs = new Date(date).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.round(diffMs / (1000 * 60))

  if (Math.abs(diffDays) >= 1) return rtf.format(diffDays, "day")
  if (Math.abs(diffHours) >= 1) return rtf.format(diffHours, "hour")
  return rtf.format(diffMinutes, "minute")
}
