import { NextResponse } from "next/server"
import { redis, geoSearchRatelimit } from "@/lib/redis/client"
import { findProvidersNearLocation } from "@/lib/db/queries/geo"
import { headers } from "next/headers"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const ip = (await headers()).get("x-forwarded-for") ?? "anonymous"
  const { success } = await geoSearchRatelimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
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
}
