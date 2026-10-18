import { shell, esc, H1S, PS, BTNS, THX } from "./emailShell"

// Admin-facing emails. ENGLISH ONLY, deliberately: the admin area is excluded from translation
// (see the i18n notes), so there is no recipient locale to honour here. Every other email in the
// app is localized by the recipient's `users.locale`; these are the one exception, on purpose.
//
// The existing admin alerts (overdue, disputes, awaiting-confirmation, contact, support) send bare
// HTML with no branding. These use the same shell as the customer-facing mail so the admin's inbox
// looks like the rest of DORIXÉ.

const TH =
  "padding:8px 10px;border-bottom:2px solid #2B3441;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6B7280;text-align:left;"
const TD = "padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:14px;vertical-align:top;"

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th style="${TH}">${esc(h)}</th>`).join("")
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td style="${TD}">${c}</td>`).join("")}</tr>`)
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function h2(text: string): string {
  return `<h2 style="font-family:Georgia,serif;font-size:17px;margin:22px 0 10px;color:#2B3441;">${esc(text)}</h2>`
}

export interface DigestCleaning {
  number: string
  when: string
  client: string
  cleaner: string
  cleanerPhone: string
  address: string
}

export interface DigestSignup {
  name: string
  email: string
  role: string
  when: string
}

export interface DigestAttention {
  label: string
  detail: string
  url?: string
}

/**
 * The daily digest. Caller MUST skip sending when every section is empty — a daily email that
 * always arrives and usually says nothing trains the reader to ignore it, which is the opposite
 * of the point. `hasContent` below is the check to use.
 */
export function adminDigestEmail(d: {
  today: DigestCleaning[]
  tomorrow: DigestCleaning[]
  signups: DigestSignup[]
  attention: DigestAttention[]
  siteUrl: string
}): { subject: string; html: string } {
  const bits: string[] = []
  if (d.today.length) bits.push(`${d.today.length} cleaning${d.today.length === 1 ? "" : "s"} today`)
  if (d.tomorrow.length) bits.push(`${d.tomorrow.length} tomorrow`)
  if (d.signups.length) bits.push(`${d.signups.length} new signup${d.signups.length === 1 ? "" : "s"}`)
  if (d.attention.length) bits.push(`${d.attention.length} needing attention`)
  const subject = `DORIXÉ daily — ${bits.length ? bits.join(", ") : "nothing outstanding"}`

  const cleaningRows = (list: DigestCleaning[]) =>
    table(
      ["Time", "Booking", "Cleaner", "Client", "Address"],
      list.map((c) => [
        `<strong>${esc(c.when)}</strong>`,
        esc(c.number),
        // The phone number is the whole point of this section: she must be able to chase a cleaner
        // straight from the email, without going to look the number up.
        `${esc(c.cleaner)}<br><a href="tel:${esc(c.cleanerPhone)}" style="color:#2D7A5F;">${esc(c.cleanerPhone || "no phone on file")}</a>`,
        esc(c.client),
        esc(c.address),
      ]),
    )

  let inner = `<h1 style="${H1S}">Today at DORIXÉ</h1>`

  if (d.attention.length) {
    inner += h2("Needs your attention")
    inner += table(
      ["What", "Detail"],
      d.attention.map((a) => [
        `<strong>${esc(a.label)}</strong>`,
        a.url ? `${esc(a.detail)} — <a href="${esc(a.url)}" style="color:#2D7A5F;">open</a>` : esc(a.detail),
      ]),
    )
  }

  if (d.today.length) {
    inner += h2("Cleanings today")
    inner += cleaningRows(d.today)
  }
  if (d.tomorrow.length) {
    inner += h2("Cleanings tomorrow")
    inner += cleaningRows(d.tomorrow)
  }
  if (!d.today.length && !d.tomorrow.length) {
    inner += h2("Cleanings")
    inner += `<p style="${PS}">No cleanings scheduled for today or tomorrow.</p>`
  }

  if (d.signups.length) {
    inner += h2("New signups (last 24 hours)")
    inner += table(
      ["Who", "Role", "Email", "When"],
      d.signups.map((s) => [esc(s.name || "—"), esc(s.role), esc(s.email), esc(s.when)]),
    )
  }

  inner += `<p style="${PS}"><a href="${esc(d.siteUrl)}/admin/bookings" style="${BTNS}">Open the admin panel</a></p>`
  inner += `<p style="${THX}">Times are shown in each cleaner's own timezone, because that is the clock they work to.</p>`

  return { subject, html: shell(inner) }
}

/** True when the digest has anything worth sending. */
export function hasContent(d: {
  today: unknown[]
  tomorrow: unknown[]
  signups: unknown[]
  attention: unknown[]
}): boolean {
  return d.today.length > 0 || d.tomorrow.length > 0 || d.signups.length > 0 || d.attention.length > 0
}

// NOTE: there are deliberately no per-event templates here for "capture failed" or "no-show
// reported". Both go through alertAdmins() in lib/notifications/adminAlert.ts, which files the
// alert in the admin bell AND emails it — one place covering all six of its call sites, instead of
// a separate template per event that the next new alert would forget to use.
