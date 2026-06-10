import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { recurringSchedules, providers, providerServices, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { stripe } from "@/lib/stripe/client"

const createSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceAddress: z.record(z.string(), z.string()),
  ecoOptions: z.array(z.string()).max(10).optional(),
  specialInstructions: z.string().max(1000).optional(),
  paymentMethodId: z.string().startsWith("pm_"),
  timezone: z.string().min(1).max(100).default("Europe/Amsterdam"),
})

function nextOccurrenceUTC(dayOfWeek: number, preferredTime: string, timezone: string): Date {
  const [hours, minutes] = preferredTime.split(":").map(Number)
  const now = new Date()
  const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  for (let i = 0; i < 8; i++) {
    const probe = new Date(startUTC.getTime() + i * 86_400_000)

    const localDOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      .indexOf(new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" }).format(probe))

    if (localDOW !== dayOfWeek) continue

    const localDate = probe.toLocaleDateString("sv-SE", { timeZone: timezone })
    const h = String(hours).padStart(2, "0")
    const m = String(minutes).padStart(2, "0")
    const testUTC = new Date(`${localDate}T${h}:${m}:00Z`)

    // Measure the timezone offset at this moment and correct for it
    const inTZ = testUTC.toLocaleString("sv-SE", { timeZone: timezone })
    const [tzH, tzM] = inTZ.split(" ")[1].split(":").map(Number)
    const driftMs = ((hours * 60 + minutes) - (tzH * 60 + tzM)) * 60_000

    return new Date(testUTC.getTime() + driftMs)
  }

  throw new Error("Could not find next occurrence in 8 days")
}

export async function GET() {
  try {
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
        timezone: recurringSchedules.timezone,
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
  } catch (err) {
    console.error("[recurring GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [user] = await db
      .select({
        role: users.role,
        email: users.email,
        firstName: users.firstName,
        stripeCustomerId: users.stripeCustomerId,
      })
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

    const {
      providerId, serviceId, frequency, dayOfWeek, preferredTime,
      serviceAddress, ecoOptions, specialInstructions, paymentMethodId, timezone,
    } = parsed.data

    const [provider] = await db
      .select({ id: providers.id, isApproved: providers.isApproved, isSuspended: providers.isSuspended })
      .from(providers)
      .where(eq(providers.id, providerId))

    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    if (!provider.isApproved || provider.isSuspended) {
      return NextResponse.json({ error: "Provider is not available" }, { status: 400 })
    }

    const [service] = await db
      .select({ id: providerServices.id, providerId: providerServices.providerId })
      .from(providerServices)
      .where(and(eq(providerServices.id, serviceId), eq(providerServices.providerId, providerId)))

    if (!service) return NextResponse.json({ error: "Service not found for this provider" }, { status: 404 })

    // Get or create Stripe Customer to attach the payment method
    let stripeCustomerId = user.stripeCustomerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.firstName ?? undefined,
        metadata: { userId },
      })
      stripeCustomerId = customer.id
      await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId))
    }

    // Attach the payment method to the customer (idempotent)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })
    } catch (err: unknown) {
      const stripeErr = err as { code?: string }
      if (stripeErr?.code !== "resource_already_exists") throw err
    }

    const nextBookingAt = nextOccurrenceUTC(dayOfWeek, preferredTime, timezone)

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
        stripePaymentMethodId: paymentMethodId,
        timezone,
        status: "active",
        nextBookingAt,
      })
      .returning({ id: recurringSchedules.id })

    await inngest.send({
      name: "recurring/schedule.created",
      data: { scheduleId: result.id },
    })

    return NextResponse.json({ scheduleId: result.id }, { status: 201 })
  } catch (err) {
    console.error("[recurring POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
