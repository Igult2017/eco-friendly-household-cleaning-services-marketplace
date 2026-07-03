import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { jobPosts, users, bookings, payments, providers } from "@/lib/db/schema"
import { eq, and, count, inArray } from "drizzle-orm"
import { stripe } from "@/lib/stripe/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Upwork-style "About the client" for the job detail page — visible to signed-in cleaners only.
// Exposes trust signals (hiring history, payment method on file), never contact data: first name +
// last initial, member-since, job/hire/booking counts, payment-verified flag.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid job id" }, { status: 400 })

    const [viewer] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!viewer) return NextResponse.json({ error: "Cleaners only" }, { status: 403 })

    const [job] = await db.select({ customerId: jobPosts.customerId }).from(jobPosts).where(eq(jobPosts.id, id))
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    const cid = job.customerId

    const [client] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt, stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, cid))

    const [[jp], [hires], [cb], [pay]] = await Promise.all([
      db.select({ n: count() }).from(jobPosts).where(eq(jobPosts.customerId, cid)),
      db.select({ n: count() }).from(jobPosts).where(and(eq(jobPosts.customerId, cid), inArray(jobPosts.status, ["assigned", "completed"]))),
      db.select({ n: count() }).from(bookings).where(and(eq(bookings.customerId, cid), eq(bookings.status, "completed"))),
      db.select({ n: count() }).from(payments).where(and(eq(payments.customerId, cid), inArray(payments.status, ["authorized", "captured"]))),
    ])

    // Payment on file: any authorized/captured payment proves it cheaply; otherwise check for a
    // saved card on their Stripe customer (best-effort — Stripe being down must not 500 the panel).
    let paymentOnFile = Number(pay?.n ?? 0) > 0
    if (!paymentOnFile && client?.stripeCustomerId) {
      try {
        const pms = await stripe.paymentMethods.list({ customer: client.stripeCustomerId, type: "card", limit: 1 })
        paymentOnFile = pms.data.length > 0
      } catch { /* leave false */ }
    }

    const name = `${client?.firstName ?? ""} ${client?.lastName ? client.lastName[0] + "." : ""}`.trim()
    return NextResponse.json({
      name: name || "Client",
      memberSince: client?.createdAt ?? null,
      jobsPosted: Number(jp?.n ?? 0),
      hires: Number(hires?.n ?? 0),
      completedBookings: Number(cb?.n ?? 0),
      paymentOnFile,
    })
  } catch (err) {
    console.error("[jobs/[id]/client GET]", err)
    void logError({ message: "[jobs/[id]/client GET]", error: err, route: "/api/jobs/[id]/client", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
