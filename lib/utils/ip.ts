import { isIP } from "node:net"

/**
 * The visitor's real client IP from the proxy's forwarded headers, validated as a genuine
 * IPv4/IPv6 address. XFF is spoofable, so anything that isn't a real IP (or is loopback/
 * unspecified) is rejected. Returns null when it can't be determined — callers must treat null
 * as "unknown" and fail safe (never match/block on a null IP).
 */
export function getClientIp(req: Request): string | null {
  const valid = (s: string | null | undefined): string | null => {
    const v = (s ?? "").trim()
    return v && isIP(v) !== 0 && !v.startsWith("0.") && v !== "127.0.0.1" && v !== "::1" ? v : null
  }
  const xff = req.headers.get("x-forwarded-for")
  const first = xff ? valid(xff.split(",")[0]) : null
  return first ?? valid(req.headers.get("cf-connecting-ip")) ?? valid(req.headers.get("x-real-ip"))
}
