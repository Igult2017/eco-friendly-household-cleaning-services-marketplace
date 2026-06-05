import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, providerAvailability, providerBlackoutDates } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean(),
})

const blackoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

  const [availability, blackouts] = await Promise.all([
    db.select().from(providerAvailability).where(eq(providerAvailability.providerId, provider.id)),
    db.select().from(providerBlackoutDates).where(eq(providerBlackoutDates.providerId, provider.id)),
  ])

  return NextResponse.json({ availability, blackouts })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

  const body = await req.json()

  if (body.type === "availability") {
    const parsed = availabilitySchema.safeParse(body.data)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { dayOfWeek, startTime, endTime, isActive } = parsed.data

    // Upsert by day
    const existing = await db.select({ id: providerAvailability.id }).from(providerAvailability)
      .where(and(eq(providerAvailability.providerId, provider.id), eq(providerAvailability.dayOfWeek, dayOfWeek)))

    if (existing.length > 0) {
      await db.update(providerAvailability).set({ startTime, endTime, isActive })
        .where(eq(providerAvailability.id, existing[0].id))
    } else {
      await db.insert(providerAvailability).values({ providerId: provider.id, dayOfWeek, startTime, endTime, isActive })
    }

    return NextResponse.json({ success: true })
  }

  if (body.type === "blackout") {
    const parsed = blackoutSchema.safeParse(body.data)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    await db.insert(providerBlackoutDates).values({ providerId: provider.id, date: parsed.data.date, reason: parsed.data.reason })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 })
}
