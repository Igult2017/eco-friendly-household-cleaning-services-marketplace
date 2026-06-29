import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { logError } from "@/lib/utils/logError"

async function customerStripeId(userId: string): Promise<string | null> {
  const [u] = await db.select({ stripeCustomerId: users.stripeCustomerId, role: users.role }).from(users).where(eq(users.id, userId))
  if (!u || u.role !== "customer") return null
  return u.stripeCustomerId ?? null
}

// List the client's saved cards + which one is the default.
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const customerId = await customerStripeId(userId)
    if (!customerId) return NextResponse.json({ cards: [], defaultId: null })

    const customer = await stripe.customers.retrieve(customerId)
    const defaultId =
      typeof customer !== "string" && !customer.deleted
        ? ((customer.invoice_settings?.default_payment_method as string | null) ?? null)
        : null

    const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card" })
    const cards = pms.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "••••",
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
    }))
    return NextResponse.json({ cards, defaultId })
  } catch (err) {
    console.error("[payments/methods GET]", err)
    void logError({ message: "[payments/methods GET]", error: err, route: "/api/payments/methods", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Detach a card or set it as the default. Only acts on cards owned by this customer.
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const customerId = await customerStripeId(userId)
    if (!customerId) return NextResponse.json({ error: "No payment profile" }, { status: 400 })

    const { action, paymentMethodId } = await req.json().catch(() => ({} as { action?: string; paymentMethodId?: string }))
    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return NextResponse.json({ error: "paymentMethodId required" }, { status: 400 })
    }

    // Ownership check — never act on a payment method that isn't this customer's.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (pm.customer !== customerId) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (action === "detach") {
      await stripe.paymentMethods.detach(paymentMethodId)
    } else if (action === "setDefault") {
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[payments/methods POST]", err)
    void logError({ message: "[payments/methods POST]", error: err, route: "/api/payments/methods", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
