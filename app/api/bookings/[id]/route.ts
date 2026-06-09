import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
}
