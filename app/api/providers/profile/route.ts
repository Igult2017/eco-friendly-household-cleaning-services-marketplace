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
    const { userId, sessionClaims } = await auth()
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

    // Single existence check — also feeds address fallback for geocoding + the upsert branch below.
    const [existing] = await db
      .select({ id: providers.id, city: providers.city, postalCode: providers.postalCode, country: providers.country })
      .from(providers)
      .where(eq(providers.userId, userId))

    // Auto-geocode when address fields are present
    if (data.city || data.postalCode || data.country) {
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

    if (existing) {
      await db.update(providers).set(updateFields).where(eq(providers.userId, userId))
      return NextResponse.json({ success: true })
    }

    // No provider row yet — create one. This is the path an admin or dual-role user hits when
    // setting up their cleaner account from the profile page for the first time. Previously the
    // UPDATE matched 0 rows and silently "saved" nothing. Gate creation to cleaner-eligible users.
    // Eligibility + admin status come from CLERK metadata (the source of truth the layouts use).
    // An admin's DB users.role is frequently still "customer" — their admin status lives only in
    // Clerk publicMetadata — so gating on the DB role wrongly 403'd admins creating their cleaner
    // profile. dualRoleEnabled (DB) is kept as an extra fallback.
    const meta = (sessionClaims?.metadata ?? {}) as { role?: string; dualRole?: boolean }
    const [dbUser] = await db
      .select({ dualRoleEnabled: users.dualRoleEnabled })
      .from(users)
      .where(eq(users.id, userId))
    const isAdmin = meta.role === "admin"
    const eligible = isAdmin || meta.role === "provider" || meta.dualRole === true || dbUser?.dualRoleEnabled === true
    if (!eligible) return NextResponse.json({ error: "Not eligible to set up a cleaner profile" }, { status: 403 })
    if (!data.businessName || !data.country) {
      return NextResponse.json({ error: "Business name and country are required to create your cleaner profile" }, { status: 400 })
    }

    const insertData: NewProvider = {
      userId,
      slug: toSlug(data.businessName, nanoid(6)),
      businessName: data.businessName,
      bio: data.bio ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country,
      serviceRadiusKm: data.serviceRadiusKm ?? 25,
      ecoLevel: data.ecoLevel ?? "basic",
      recurringDiscountPct: data.recurringDiscountPct ?? 0,
      carbonOffsetEnabled: Boolean(body.carbonOffsetEnabled),
      profilePhotoUrl: data.profilePhotoUrl ?? null,
      latitude: (updateFields.latitude as number | undefined) ?? null,
      longitude: (updateFields.longitude as number | undefined) ?? null,
      // An admin setting up their OWN cleaner account is trusted → approve immediately so they
      // can operate/test as a cleaner. Everyone else stays unapproved (normal approval path).
      isApproved: isAdmin,
      isSuspended: false,
    }
    await db.insert(providers).values(insertData)

    return NextResponse.json({ success: true, created: true }, { status: 201 })
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
