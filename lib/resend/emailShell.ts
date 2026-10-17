import { isLocale, defaultLocale } from "@/i18n/config"

// The branded wrapper and text helpers every transactional email shares. Pulled out of
// transactionalEmails.ts so a second family of templates (activityEmails.ts) can reuse the exact
// same shell — two copies of this markup would drift the first time the branding changed.

/** Falls back to English for an unknown or missing locale. */
export function loc(locale: string | null | undefined): string {
  return isLocale(locale) ? locale : defaultLocale
}

/** Escapes anything a user supplied before it goes into the HTML. */
export function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Fills {placeholders} in a template string. An unknown key becomes empty rather than literal. */
export function sub(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : ""))
}

export function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">${inner}</div>
  </div></body></html>`
}

export const H1S = "font-family:Georgia,serif;font-size:22px;margin:0 0 14px;"
export const PS = "margin:0 0 12px;"
export const BTNS = "display:inline-block;background:#2D7A5F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;margin:6px 0;"
export const THX = "margin:18px 0 0;color:#6B7280;font-size:13px;"
