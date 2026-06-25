import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params

    const [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(and(eq(providers.userId, userId), eq(providers.isSuspended, false)))

    if (!provider) return NextResponse.json({ error: "Not a provider or account suspended" }, { status: 403 })

    const [booking] = await db
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id)))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    if (!["confirmed", "in_progress"].includes(booking.status)) {
      return NextResponse.json(
        { error: "Before photos can only be uploaded when booking is confirmed or in progress" },
        { status: 422 }
      )
    }

    const body = await req.json().catch(() => ({})) as { photoUrls?: unknown }
    const { photoUrls } = body

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      return NextResponse.json({ error: "photoUrls must be a non-empty array" }, { status: 400 })
    }

    const r2Base = process.env.R2_PUBLIC_URL ?? ""
    if (!r2Base) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    const allValid = (photoUrls as unknown[]).every(
      (url) => typeof url === "string" && url.startsWith(r2Base)
    )

    if (!allValid) {
      return NextResponse.json(
        { error: "All photo URLs must start with the configured R2_PUBLIC_URL" },
        { status: 400 }
      )
    }

    const validUrls = photoUrls as string[]

    await db
      .update(bookings)
      .set({ beforePhotoUrls: validUrls })
      .where(and(eq(bookings.id, bookingId), eq(bookings.providerId, provider.id))) // L4: scope UPDATE to owner

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/before-photos POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: bookingId } = await params

    const [booking] = await db
      .select({
        customerId: bookings.customerId,
        providerId: bookings.providerId,
        beforePhotoUrls: bookings.beforePhotoUrls,
        providerUserId: providers.userId,
      })
      .from(bookings)
      .leftJoin(providers, eq(providers.id, bookings.providerId))
      .where(eq(bookings.id, bookingId))

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 })

    const isCustomer = booking.customerId === userId
    const isProvider = booking.providerUserId === userId

    if (!isCustomer && !isProvider) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ beforePhotoUrls: booking.beforePhotoUrls ?? [] })
  } catch (err) {
    console.error("[bookings/[id]/before-photos GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
