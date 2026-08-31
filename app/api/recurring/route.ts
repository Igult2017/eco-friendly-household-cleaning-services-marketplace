import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { recurringSchedules, providers, providerServices, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { stripe } from "@/lib/stripe/client"
import { getOrCreateStripeCustomer } from "@/lib/stripe/getOrCreateCustomer"
import { logError } from "@/lib/utils/logError"

const createSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  serviceAddress: z.record(z.string(), z.string()),
  ecoOptions: z.array(z.string()).max(10).optional(),
  specialInstructions: z.string().max(1000).optional(),
  paymentMethodId: z.string().startsWith("pm_").optional(),
  // Alternative to paymentMethodId — the wizard's just-completed booking PaymentIntent. The payment
  // method actually used for that charge is resolved server-side from it (setup_future_usage saved
  // it), so the wizard can set up the schedule without separately asking which card to reuse.
  paymentIntentId: z.string().startsWith("pi_").optional(),
  timezone: z.string().min(1).max(100).default("Europe/Amsterdam"),
  // The customer MUST affirmatively authorize recurring auto-charge before a schedule is created
  // (US Click-to-Cancel / state auto-renewal laws + EU). Anything other than true fails validation,
  // so a future recurring-setup UI cannot create a schedule without showing + capturing consent.
  autoRenewConsent: z.literal(true),
}).refine((d) => d.paymentMethodId || d.paymentIntentId, { message: "paymentMethodId or paymentIntentId is required" })

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
    void logError({ message: "[recurring GET]", error: err, route: "/api/recurring", severity: "error" })
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

    const body = await req.json().catch(() => ({}))
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 })
    }

    const {
      providerId, serviceId, frequency, dayOfWeek, preferredTime,
      serviceAddress, ecoOptions, specialInstructions, timezone,
    } = parsed.data

    let paymentMethodId = parsed.data.paymentMethodId
    if (!paymentMethodId && parsed.data.paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId)
      // Ownership check — never resolve a payment method off someone ELSE's PaymentIntent.
      if (pi.metadata?.clerk_customer_id !== userId) {
        return NextResponse.json({ error: "That booking doesn't belong to you." }, { status: 403 })
      }
      const pm = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id
      if (!pm) {
        return NextResponse.json({ error: "Couldn't find a saved payment method on that booking." }, { status: 422 })
      }
      paymentMethodId = pm
    }
    if (!paymentMethodId) {
      return NextResponse.json({ error: "paymentMethodId or paymentIntentId is required" }, { status: 422 })
    }

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

    // Single shared resolver — see lib/stripe/getOrCreateCustomer.ts for why every payment
    // flow must resolve the Stripe customer the same way (a card saved through one flow has to
    // be visible to every other one).
    const stripeCustomerId = await getOrCreateStripeCustomer(userId)

    // Attach the payment method to the customer (idempotent)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })
    } catch (err: unknown) {
      const stripeErr = err as { code?: string; type?: string }
      if (stripeErr?.code === "resource_already_exists") {
        // already attached to this customer — fine
      } else if (stripeErr?.type === "StripeInvalidRequestError" || stripeErr?.type === "StripeCardError") {
        // BUG-023: invalid/declined/foreign payment method → client error, not an opaque 500
        return NextResponse.json({ error: "That payment method can't be used. Please add it again." }, { status: 422 })
      } else {
        throw err
      }
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
        autoRenewConsentAt: new Date(),
        nextBookingAt,
      })
      .returning({ id: recurringSchedules.id })

    try {
      await inngest.send({
        name: "recurring/schedule.created",
        data: { scheduleId: result.id },
      })
    } catch (inngestErr) {
      console.warn("[recurring POST] Inngest send failed:", inngestErr instanceof Error ? inngestErr.message : inngestErr)
    }

    return NextResponse.json({ scheduleId: result.id }, { status: 201 })
  } catch (err) {
    console.error("[recurring POST]", err)
    void logError({ message: "[recurring POST]", error: err, route: "/api/recurring", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
