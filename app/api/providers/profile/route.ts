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

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user || user.role !== "provider") {
      return NextResponse.json({ error: "Must be a provider" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = providerProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data

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
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
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
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
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
