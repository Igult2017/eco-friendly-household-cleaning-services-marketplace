import { createHmac } from "node:crypto"

// Signed, stateless unsubscribe tokens so the link in any email can flip
// marketingConsent off without a DB lookup or login. HMAC over the userId.
const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.CLERK_SECRET_KEY ?? "dev-unsub-secret"

function sign(userId: string): string {
  return createHmac("sha256", SECRET).update(userId).digest("base64url").slice(0, 32)
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

export function unsubscribeUrl(userId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://xn--dorix-fsa.com"
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(makeUnsubToken(userId))}`
}
