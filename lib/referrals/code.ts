// Vanity referral codes. Stored lowercased and compared case-insensitively. Allowed: letters, digits,
// and hyphens, 3–24 chars. Legacy random codes (uppercase A–Z0–9, 8 chars) still validate + resolve.

export const REF_CODE_MIN = 3
export const REF_CODE_MAX = 24

// Words that would be confusing, collide with routes/brand, or look official — keep them off-limits.
const RESERVED = new Set([
  "admin", "api", "app", "www", "dorix", "dorixe", "ref", "null", "undefined", "true", "false",
  "sign-in", "sign-up", "signin", "signup", "login", "logout", "dashboard", "partner",
  "affiliate", "affiliates", "onboarding", "provider", "providers", "customer", "customers",
  "support", "help", "account", "settings", "store", "eco-store", "blog", "browse", "home", "test",
])

/** Coerce arbitrary input into a valid code shape: lowercase, spaces/underscores → hyphen, strip the
 *  rest, collapse + trim hyphens, cap length. */
export function normalizeRefCode(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, REF_CODE_MAX)
}

export type RefCodeCheck = { ok: true; code: string } | { ok: false; code: string; error: string }

export function validateRefCode(input: string): RefCodeCheck {
  const code = normalizeRefCode(input)
  if (code.length < REF_CODE_MIN) return { ok: false, code, error: `Use at least ${REF_CODE_MIN} letters or numbers.` }
  if (RESERVED.has(code)) return { ok: false, code, error: "That word is reserved — please pick another." }
  return { ok: true, code }
}
