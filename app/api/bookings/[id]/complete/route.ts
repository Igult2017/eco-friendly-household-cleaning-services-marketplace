import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, payments, providers, notifications } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { inngest } from "@/lib/inngest/client"
import { safeLimit, bookingActionRatelimit } from "@/lib/redis/client"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(bookingActionRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 })

    const { id: bookingId } = await params
    if (!isUuid(bookingId)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })

    // Bug 7: fail loudly if R2 is not configured — silent filtering would drop all photos
    const R2_BASE = process.env.R2_PUBLIC_URL
    if (!R2_BASE) return NextResponse.json({ error: "File storage not configured" }, { status: 500 })

    // Bug 4: reject suspended providers — they must not be able to trigger payment capture
    const [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Not a provider or account suspended" }, { status: 403 })

    const [booking] = await db
      .select({ id: bookings.id, status: bookings.status, customerId: bookings.customerId, providerId: bookings.providerId, scheduledAt: bookings.scheduledAt, clientConfirmedAt: bookings.clientConfirmedAt })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (!["payment_authorized", "confirmed", "in_progress"].includes(booking.status)) {
      return NextResponse.json({ error: "Booking cannot be completed in its current state" }, { status: 422 })
    }
    // H4: don't allow capturing the customer's card before the appointment time unless the job was
    // explicitly started (in_progress) — blocks "book now, complete + capture immediately" fraud.
    if (booking.status !== "in_progress" && booking.scheduledAt && new Date(booking.scheduledAt) > new Date()) {
      return NextResponse.json({ error: "Booking cannot be completed before its scheduled time" }, { status: 422 })
    }

    const body = await req.json().catch(() => ({} as { photoUrls?: unknown }))
    const rawUrls: unknown[] = Array.isArray(body.photoUrls) ? body.photoUrls : []

    // Only accept URLs from our own R2 bucket to prevent stored XSS via external URLs
    const photoUrls = rawUrls.filter(
      (u): u is string => typeof u === "string" && u.startsWith(R2_BASE),
    )

    // Bug 2: set to pending_capture, not completed — Inngest sets completed after capture succeeds.
    // H4: atomic conditional transition — only one concurrent /complete can flip the state, so the
    // booking/completed event (→ capture) can't be fired twice by a double-submit.
    const updated = await db
      .update(bookings)
      .set({ status: "pending_capture", completionPhotoUrls: photoUrls, actualEndAt: new Date(), providerCompletedAt: new Date() })
      .where(and(
        eq(bookings.id, bookingId),
        eq(bookings.providerId, provider.id),
        inArray(bookings.status, ["payment_authorized", "confirmed", "in_progress"]),
      ))
      .returning({ id: bookings.id })
    if (updated.length === 0) {
      return NextResponse.json({ error: "Booking cannot be completed in its current state" }, { status: 422 })
    }

    // Dual-confirm: the cleaner has marked the job done. Payment is released to them only once the
    // CLIENT also confirms (or an admin releases it). Capture now ONLY if the client already confirmed.
    if (booking.clientConfirmedAt) {
      const [payment] = await db.select({ stripePaymentIntentId: payments.stripePaymentIntentId }).from(payments).where(eq(payments.bookingId, bookingId))
      if (payment) {
        try {
          await inngest.send({ name: "booking/completed", data: { bookingId, paymentIntentId: payment.stripePaymentIntentId, providerId: provider.id, customerId: booking.customerId } })
        } catch (e) { console.warn("[bookings/complete POST] capture send failed:", e) }
      }
    } else {
      // Ask the client to confirm + start the admin-nudge timer. No money moves yet.
      try {
        await db.insert(notifications).values({
          userId: booking.customerId,
          type: "booking_confirmed",
          title: "Confirm your cleaning is done",
          body: "Your cleaner marked the job complete. Please confirm to release payment.",
          link: `/bookings/${bookingId}`,
          metadata: { variant: "client_confirm_request" },
        })
        await inngest.send({ name: "booking/awaiting-confirmation", data: { bookingId } })
      } catch (e) { console.warn("[bookings/complete POST] notify/await send failed:", e) }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/complete POST]", err)
    void logError({ message: "[bookings/[id]/complete POST]", error: err, route: "/api/bookings/[id]/complete", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
