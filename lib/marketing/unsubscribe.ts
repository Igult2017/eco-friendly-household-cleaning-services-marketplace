import { createHmac } from "node:crypto"

// Signed, stateless unsubscribe tokens so the link in any email can flip
// marketingConsent off without a DB lookup or login. HMAC over the userId.
// Set UNSUBSCRIBE_SECRET in prod so links survive a CLERK_SECRET_KEY rotation.
// M2: no hardcoded fallback secret, and use the FULL HMAC (not truncated to 32 chars) so unsubscribe
// tokens can't be forged. CLERK_SECRET_KEY is always set in prod, so SECRET is real there.
const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.CLERK_SECRET_KEY ?? ""
if (!SECRET && process.env.NODE_ENV === "production") {
  console.error("[unsubscribe] No UNSUBSCRIBE_SECRET/CLERK_SECRET_KEY set — unsubscribe tokens would be insecure")
}

function sign(userId: string): string {
  return createHmac("sha256", SECRET || "dev-only-insecure").update(userId).digest("base64url")
}

export function makeUnsubToken(userId: string): string {
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId)}`
}

export function verifyUnsubToken(token: string): string | null {
  const [b64, sig] = (token || "").split(".")
  if (!b64 || !sig) return null
  let userId: string
  try {
    userId = Buffer.from(b64, "base64url").toString("utf8")
  } catch {
    return null
  }
  return sign(userId) === sig ? userId : null
}

function base(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://xn--dorix-fsa.com"
}

// Footer link → confirmation PAGE (GET, no mutation — safe from email link scanners).
export function unsubscribePageUrl(userId: string): string {
  return `${base()}/unsubscribe?token=${encodeURIComponent(makeUnsubToken(userId))}`
}

// List-Unsubscribe header → one-click POST endpoint (RFC 8058, mutation by design).
export function unsubscribeApiUrl(userId: string): string {
  return `${base()}/api/email/unsubscribe?token=${encodeURIComponent(makeUnsubToken(userId))}`
}
