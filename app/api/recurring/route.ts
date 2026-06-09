import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { recurringSchedules, providers, providerServices, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"

const createSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceAddress: z.record(z.string(), z.string()),
  ecoOptions: z.array(z.string()).max(10).optional(),
  specialInstructions: z.string().max(1000).optional(),
})

function nextOccurrence(dayOfWeek: number, preferredTime: string): Date {
  const [hours, minutes] = preferredTime.split(":").map(Number)
  const now = new Date()
  const candidate = new Date(now)
  candidate.setDate(now.getDate() + 1)
  candidate.setHours(hours, minutes, 0, 0)

  for (let i = 0; i < 7; i++) {
    if (candidate.getDay() === dayOfWeek) break
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || user.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const schedules = await db
    .select({
      id: recurringSchedules.id,
      customerId: recurringSchedules.customerId,
      providerId: recurringSchedules.providerId,
      serviceId: recurringSchedules.serviceId,
      frequency: recurringSchedules.frequency,
      dayOfWeek: recurringSchedules.dayOfWeek,
      preferredTime: recurringSchedules.preferredTime,
      serviceAddress: recurringSchedules.serviceAddress,
      ecoOptions: recurringSchedules.ecoOptions,
      specialInstructions: recurringSchedules.specialInstructions,
      status: recurringSchedules.status,
      nextBookingAt: recurringSchedules.nextBookingAt,
      createdAt: recurringSchedules.createdAt,
      updatedAt: recurringSchedules.updatedAt,
      providerBusinessName: providers.businessName,
      serviceName: providerServices.name,
    })
    .from(recurringSchedules)
    .innerJoin(providers, eq(recurringSchedules.providerId, providers.id))
    .innerJoin(providerServices, eq(recurringSchedules.serviceId, providerServices.id))
    .where(eq(recurringSchedules.customerId, userId))

  return NextResponse.json({ schedules })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || user.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 })
  }

  const { providerId, serviceId, frequency, dayOfWeek, preferredTime, serviceAddress, ecoOptions, specialInstructions } = parsed.data

  const [provider] = await db
    .select({ id: providers.id, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
    .from(providers)
    .where(eq(providers.id, providerId))

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 })
  }
  if (!provider.isApproved || provider.isSuspended) {
    return NextResponse.json({ error: "Provider is not available" }, { status: 400 })
  }

  const [service] = await db
    .select({ id: providerServices.id, providerId: providerServices.providerId })
    .from(providerServices)
    .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId)))

  if (!service) {
    return NextResponse.json({ error: "Service not found for this provider" }, { status: 404 })
  }

  const nextBookingAt = nextOccurrence(dayOfWeek, preferredTime)

  const [result] = await db
    .insert(recurringSchedules)
    .values({
      customerId: userId,
      providerId,
      serviceId,
      frequency,
      dayOfWeek,
      preferredTime,
      serviceAddress,
      ecoOptions: ecoOptions ?? [],
      specialInstructions,
      status: "active",
      nextBookingAt,
    })
    .returning({ id: recurringSchedules.id })

  await inngest.send({
    name: "recurring/schedule.created",
    data: { scheduleId: result.id },
  })

  return NextResponse.json({ scheduleId: result.id }, { status: 201 })
}
