import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Booking / payment creation: 10 requests per 60 seconds per user
export const bookingRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.tokenBucket(10, "60 s", 10),
  prefix: "ratelimit:booking",
})

// Geo search: 30 per minute per IP (public endpoint)
export const geoSearchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "ratelimit:geo",
})

// File upload presigned URL: 20 per hour per user
export const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 m"),
  prefix: "ratelimit:upload",
})

// Job post creation: 5 per 10 minutes per user
export const jobRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  prefix: "ratelimit:job",
})

// Bid submission: 10 per 5 minutes per user
export const bidRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  prefix: "ratelimit:bid",
})
