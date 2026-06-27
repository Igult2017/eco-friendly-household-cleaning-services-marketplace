import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const booking = await db.query.bookings.findFirst({
      where: (b, { eq: eqFn, and: andFn }) => andFn(eqFn(b.id, id), eqFn(b.customerId, userId)),
      with: {
        provider: { columns: { businessName: true } },
        service: { columns: { name: true } },
      },
    })

    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json({ booking })
  } catch (err) {
    console.error("[bookings/[id] GET]", err)
    void logError({ message: "[bookings/[id] GET]", error: err, route: "/api/bookings/[id]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
