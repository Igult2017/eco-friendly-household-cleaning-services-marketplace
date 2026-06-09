import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [user] = await db
    .select({
      stripeCustomerId: users.stripeCustomerId,
      email: users.email,
      firstName: users.firstName,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user || user.role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
  })

  return NextResponse.json({ clientSecret: setupIntent.client_secret, stripeCustomerId })
}
