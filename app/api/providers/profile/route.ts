import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import type { NewProvider } from "@/lib/db/schema/providers"
import { eq } from "drizzle-orm"
import { providerProfileSchema } from "@/lib/validations/provider"
import { nanoid } from "nanoid"

function toSlug(name: string, suffix: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").substring(0, 40) +
    "-" + suffix
  )
}

async function geocode(city: string, postalCode: string, country: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${postalCode} ${city}, ${country}`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=0`,
      { headers: { "User-Agent": "dorix-marketplace/1.0" } }
    )
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const provider = await db.query.providers.findFirst({
      where: eq(providers.userId, userId),
    })

    return NextResponse.json({ provider: provider ?? null })
  } catch (err) {
    console.error("[providers/profile GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const parsed = providerProfileSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const updateFields: Record<string, unknown> = {}

    if (data.businessName !== undefined) updateFields.businessName = data.businessName
    if (data.bio !== undefined) updateFields.bio = data.bio
    if (data.city !== undefined) updateFields.city = data.city
    if (data.postalCode !== undefined) updateFields.postalCode = data.postalCode
    if (data.country !== undefined) updateFields.country = data.country
    if (data.serviceRadiusKm !== undefined) updateFields.serviceRadiusKm = data.serviceRadiusKm
    if (data.recurringDiscountPct !== undefined) updateFields.recurringDiscountPct = data.recurringDiscountPct
    if (data.ecoLevel !== undefined) updateFields.ecoLevel = data.ecoLevel
    if (data.profilePhotoUrl !== undefined) updateFields.profilePhotoUrl = data.profilePhotoUrl
    if ("carbonOffsetEnabled" in body) updateFields.carbonOffsetEnabled = Boolean(body.carbonOffsetEnabled)

    // Auto-geocode when address fields change
    if (data.city || data.postalCode || data.country) {
      const [existing] = await db
        .select({ city: providers.city, postalCode: providers.postalCode, country: providers.country })
        .from(providers)
        .where(eq(providers.userId, userId))

      const city = data.city ?? existing?.city ?? ""
      const postalCode = data.postalCode ?? existing?.postalCode ?? ""
      const country = data.country ?? existing?.country ?? "DE"

      if (city && postalCode) {
        const coords = await geocode(city, postalCode, country)
        if (coords) {
          updateFields.latitude = coords.lat
          updateFields.longitude = coords.lng
        }
      }
    }

    // Allow explicit lat/lng override
    if (data.latitude !== undefined) updateFields.latitude = data.latitude
    if (data.longitude !== undefined) updateFields.longitude = data.longitude

    await db.update(providers).set(updateFields).where(eq(providers.userId, userId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[providers/profile PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user || user.role !== "provider") {
      return NextResponse.json({ error: "Must be a provider" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = providerProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Geocode city + postal
    let lat = data.latitude ?? null
    let lng = data.longitude ?? null
    if (!lat && data.city && data.postalCode) {
      const coords = await geocode(data.city, data.postalCode, data.country)
      if (coords) { lat = coords.lat; lng = coords.lng }
    }

    const [existing] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (existing) {
      await db
        .update(providers)
        .set({
          businessName: data.businessName,
          bio: data.bio,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
          serviceRadiusKm: data.serviceRadiusKm,
          ecoLevel: data.ecoLevel,
          latitude: lat,
          longitude: lng,
          profilePhotoUrl: data.profilePhotoUrl ?? null,
        })
        .where(eq(providers.userId, userId))
      return NextResponse.json({ success: true, providerId: existing.id })
    }

    const insertData: NewProvider = {
      userId,
      slug: toSlug(data.businessName, nanoid(6)),
      businessName: data.businessName,
      bio: data.bio ?? null,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      serviceRadiusKm: data.serviceRadiusKm,
      ecoLevel: data.ecoLevel,
      latitude: lat,
      longitude: lng,
      profilePhotoUrl: data.profilePhotoUrl ?? null,
      isApproved: false,
      isSuspended: false,
    }

    const [newProvider] = await db.insert(providers).values(insertData).returning({ id: providers.id })

    return NextResponse.json({ success: true, providerId: newProvider.id }, { status: 201 })
  } catch (err) {
    console.error("[providers/profile POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
