import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reviews, bookings, providers } from "@/lib/db/schema"
import type { NewReview } from "@/lib/db/schema/reviews"
import { eq, and, avg, count } from "drizzle-orm"
import { z } from "zod"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  overallRating: z.number().int().min(1).max(5),
  cleanlinessRating: z.number().int().min(1).max(5).optional(),
  punctualityRating: z.number().int().min(1).max(5).optional(),
  ecoComplianceRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
})

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const body = await req.json().catch(() => ({}))
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data

    const [booking] = await db
      .select({ id: bookings.id, status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId })
      .from(bookings)
      .where(and(eq(bookings.id, data.bookingId), eq(bookings.customerId, userId)))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (booking.status !== "completed") return NextResponse.json({ error: "Can only review completed bookings" }, { status: 422 })

    // Check no existing review
    const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.bookingId, data.bookingId))
    if (existing) return NextResponse.json({ error: "Review already submitted" }, { status: 409 })

    const insertData: NewReview = {
      bookingId: data.bookingId,
      customerId: userId,
      providerId: booking.providerId,
      overallRating: data.overallRating,
      cleanlinessRating: data.cleanlinessRating ?? null,
      punctualityRating: data.punctualityRating ?? null,
      ecoComplianceRating: data.ecoComplianceRating ?? null,
      communicationRating: data.communicationRating ?? null,
      title: data.title ?? null,
      body: data.body ?? null,
      isPublic: true,
      isFlagged: false,
    }

    const [newReview] = await db.insert(reviews).values(insertData).returning({ id: reviews.id })

    // Update provider average rating using SQL aggregates (avoids full table scan in JS)
    // Bug 9: exclude flagged reviews — they're hidden from public view and must not skew the rating
    const [stats] = await db
      .select({ avg: avg(reviews.overallRating), total: count() })
      .from(reviews)
      .where(and(eq(reviews.providerId, booking.providerId), eq(reviews.isFlagged, false)))

    await db
      .update(providers)
      .set({ averageRating: Math.round(parseFloat(stats.avg ?? "0") * 10) / 10, totalReviews: stats.total })
      .where(eq(providers.id, booking.providerId))

    return NextResponse.json({ reviewId: newReview.id }, { status: 201 })
  } catch (err) {
    console.error("[reviews POST]", err)
    void logError({ message: "[reviews POST]", error: err, route: "/api/reviews", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
