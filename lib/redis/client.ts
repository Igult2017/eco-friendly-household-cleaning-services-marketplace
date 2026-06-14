import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

function resolveUrl(): string {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? ""
  try {
    const p = new URL(url)
    if (p.protocol === "https:" && p.hostname) return url
  } catch { /* invalid */ }
  return "https://placeholder.upstash.io"
}

function resolveToken(): string {
  const t = process.env.UPSTASH_REDIS_REST_TOKEN ?? ""
  return t || "placeholder_token"
}

export const redis = new Redis({ url: resolveUrl(), token: resolveToken() })

export const bookingRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, "60 s", 10),
  prefix: "ratelimit:booking",
})

export const geoSearchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "ratelimit:geo",
})

export const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 m"),
  prefix: "ratelimit:upload",
})

export const jobRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  prefix: "ratelimit:job",
})

export const bidRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  prefix: "ratelimit:bid",
})

/**
 * Run a rate-limit check that NEVER throws. If Redis is unreachable or
 * unconfigured (e.g. the placeholder URL in an env without Upstash), the
 * limiter would otherwise throw and 500 the whole route. We fail OPEN —
 * allow the request through — because a missing rate limiter must never take
 * down core functionality. Logs a warning so the misconfig stays visible.
 */
export async function safeLimit(limiter: Ratelimit, identifier: string): Promise<{ success: boolean }> {
  try {
    const { success } = await limiter.limit(identifier)
    return { success }
  } catch (err) {
    console.warn("[ratelimit] unavailable, allowing through:", (err as Error)?.message ?? err)
    return { success: true }
  }
}
