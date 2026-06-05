import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { phone } = await req.json()

  // E.164 format: optional + then 7–15 digits
  if (phone !== undefined && phone !== null && phone !== "") {
    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
    }
  }

  await db
    .update(users)
    .set({
      phone: phone || null,
      gdprConsentAt: new Date(),
    })
    .where(eq(users.id, userId))

  return NextResponse.json({ success: true })
}
