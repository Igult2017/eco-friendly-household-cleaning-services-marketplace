import { NextResponse } from "next/server"
import { redis, geoSearchRatelimit } from "@/lib/redis/client"
import { findProvidersNearLocation } from "@/lib/db/queries/geo"
import { headers } from "next/headers"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const hdrs = await headers()
    // CF-Connecting-IP is set by Cloudflare and cannot be spoofed (unlike x-forwarded-for)
    const ip = hdrs.get("cf-connecting-ip") ?? hdrs.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous"
    try {
      const { success } = await geoSearchRatelimit.limit(ip)
      if (!success) return NextResponse.json({ error: "Too many searches. Please wait a moment." }, { status: 429 })
    } catch (redisErr) {
      console.warn("[geo/providers GET] Redis rate limit unavailable, allowing through:", redisErr)
    }

    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get("lat") ?? "")
    const lng = parseFloat(searchParams.get("lng") ?? "")
    const radiusKm = Math.min(parseInt(searchParams.get("radius") ?? "25"), 100)
    const categoryId = searchParams.get("categoryId") ?? undefined

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "lat and lng are required" }, { status: 400 })
    }

    const cacheKey = `geo:providers:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}:${categoryId ?? "all"}`

    const cached = await redis.get<unknown[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ providers: cached, cached: true })
    }

    const providers = await findProvidersNearLocation({ latitude: lat, longitude: lng, radiusKm, categoryId })

    await redis.setex(cacheKey, 300, JSON.stringify(providers)) // 5-min cache

    return NextResponse.json({ providers, cached: false })
  } catch (err) {
    console.error("[geo/providers GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
