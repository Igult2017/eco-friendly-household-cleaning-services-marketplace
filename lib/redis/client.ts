import Redis from "ioredis"

// Self-hosted Redis (Coolify) over TCP — REDIS_URL = redis://default:<pw>@host:6379/0
// The app runs as a long-lived `next start` server, so a persistent ioredis
// connection is the right model (not HTTP-per-request like Upstash REST).
function createClient(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn("[redis] REDIS_URL not set — cache & rate limiting disabled (fail-open)")
    return null
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false, // fail fast instead of hanging when Redis is down
    connectTimeout: 5000,
  })
  client.on("error", (e: Error) => console.warn("[redis] connection error:", e?.message ?? e))
  return client
}

const raw = createClient()

// Minimal Upstash-compatible facade over ioredis for the methods the app uses,
// so existing callers (geo cache, Stripe idempotency, booking sequence) are unchanged.
export const redis = {
  async get<T = unknown>(key: string): Promise<T | null> {
    if (!raw) return null
    try {
      const v = await raw.get(key)
      if (v == null) return null
      try { return JSON.parse(v) as T } catch { return v as unknown as T }
    } catch (e) {
      console.warn("[redis] get failed:", (e as Error)?.message ?? e)
      return null
    }
  },
  async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<"OK" | null> {
    if (!raw) return null
    const val = typeof value === "string" ? value : JSON.stringify(value)
    try {
      if (opts?.nx && opts?.ex) return await raw.set(key, val, "EX", opts.ex, "NX")
      if (opts?.ex) return await raw.set(key, val, "EX", opts.ex)
      if (opts?.nx) return await raw.set(key, val, "NX")
      return await raw.set(key, val)
    } catch (e) {
      console.warn("[redis] set failed:", (e as Error)?.message ?? e)
      return null
    }
  },
  async setex(key: string, seconds: number, value: unknown): Promise<void> {
    if (!raw) return
    const val = typeof value === "string" ? value : JSON.stringify(value)
    try { await raw.setex(key, seconds, val) } catch (e) {
      console.warn("[redis] setex failed:", (e as Error)?.message ?? e)
    }
  },
  // Sequence counter (booking numbers). Intentionally NOT swallowed — callers
  // depend on a real monotonic value; a throw surfaces a genuine outage.
  async incr(key: string): Promise<number> {
    if (!raw) throw new Error("Redis unavailable (REDIS_URL not set)")
    return raw.incr(key)
  },
  // Idempotency acquire that DISTINGUISHES a genuine duplicate from Redis being unavailable, so
  // callers (e.g. the Stripe webhook) can fail-OPEN (process the event) on "unavailable" instead of
  // silently dropping it. (M1)
  async acquireOnce(key: string, ttlSeconds: number): Promise<"acquired" | "duplicate" | "unavailable"> {
    if (!raw) return "unavailable"
    try {
      const res = await raw.set(key, "1", "EX", ttlSeconds, "NX")
      return res === "OK" ? "acquired" : "duplicate"
    } catch (e) {
      console.warn("[redis] acquireOnce failed:", (e as Error)?.message ?? e)
      return "unavailable"
    }
  },
}

export interface RateLimiter {
  limit(identifier: string): Promise<{ success: boolean }>
}

// Fixed-window limiter backed by Redis INCR + PEXPIRE. Simple, atomic-enough,
// and good for abuse prevention. Returns { success:true } when Redis is absent.
export function createRateLimiter(opts: { tokens: number; windowSeconds: number; prefix: string }): RateLimiter {
  const windowMs = opts.windowSeconds * 1000
  return {
    async limit(identifier: string): Promise<{ success: boolean }> {
      if (!raw) return { success: true }
      const bucket = Math.floor(Date.now() / windowMs)
      const key = `${opts.prefix}:${identifier}:${bucket}`
      const count = await raw.incr(key)
      if (count === 1) await raw.pexpire(key, windowMs)
      return { success: count <= opts.tokens }
    },
  }
}

export const bookingRatelimit   = createRateLimiter({ tokens: 10, windowSeconds: 60,   prefix: "ratelimit:booking" })
export const geoSearchRatelimit = createRateLimiter({ tokens: 30, windowSeconds: 60,   prefix: "ratelimit:geo" })
export const uploadRatelimit    = createRateLimiter({ tokens: 20, windowSeconds: 3600, prefix: "ratelimit:upload" })
export const jobRatelimit       = createRateLimiter({ tokens: 5,  windowSeconds: 600,  prefix: "ratelimit:job" })
export const bidRatelimit       = createRateLimiter({ tokens: 10, windowSeconds: 300,  prefix: "ratelimit:bid" })

/**
 * Run a rate-limit check that NEVER throws. If Redis is unreachable, fail OPEN
 * (allow the request) — a missing limiter must never take down core flows.
 */
export async function safeLimit(limiter: RateLimiter, identifier: string): Promise<{ success: boolean }> {
  try {
    return await limiter.limit(identifier)
  } catch (err) {
    console.warn("[ratelimit] unavailable, allowing through:", (err as Error)?.message ?? err)
    return { success: true }
  }
}
