import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { disputes, bookings, payments, users, notifications } from "@/lib/db/schema"
import { stripe } from "@/lib/stripe/client"
import { eq } from "drizzle-orm"
import { z } from "zod"

const resolveSchema = z.object({
  outcome: z.enum(["resolved_customer", "resolved_provider"]),
  resolution: z.string().min(10).max(2000),
  refundPercent: z.number().int().min(0).max(100).default(0),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify admin role
  const [admin] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: disputeId } = await params
  const body = await req.json()
  const parsed = resolveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { outcome, resolution, refundPercent } = parsed.data

  const [dispute] = await db.select({ id: disputes.id, bookingId: disputes.bookingId, status: disputes.status }).from(disputes).where(eq(disputes.id, disputeId))
  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 })
  if (["resolved_customer", "resolved_provider", "closed"].includes(dispute.status)) {
    return NextResponse.json({ error: "Dispute already resolved" }, { status: 422 })
  }

  const [booking] = await db
    .select({ id: bookings.id, totalAmount: bookings.totalAmount, customerId: bookings.customerId, providerId: bookings.providerId })
    .from(bookings)
    .where(eq(bookings.id, dispute.bookingId))

  const refundAmount = Math.round(booking.totalAmount * (refundPercent / 100))

  // Issue Stripe refund if applicable
  if (refundPercent > 0) {
    const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId, status: payments.status }).from(payments).where(eq(payments.bookingId, dispute.bookingId))
    if (payment?.status === "captured") {
      await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: refundAmount })
    }
  }

  await db.update(disputes).set({
    status: outcome,
    resolution,
    resolutionAmount: refundAmount,
    assignedAdminId: userId,
    resolvedAt: new Date(),
  }).where(eq(disputes.id, disputeId))

  await db.update(bookings).set({ status: refundPercent === 100 ? "refunded" : "completed" }).where(eq(bookings.id, dispute.bookingId))

  // Notify both parties
  await db.insert(notifications).values([
    { userId: booking.customerId, type: "dispute_resolved", title: "Your dispute has been resolved", body: resolution.slice(0, 120), link: `/bookings/${dispute.bookingId}` },
  ])

  return NextResponse.json({ success: true, refundAmount, outcome })
}
