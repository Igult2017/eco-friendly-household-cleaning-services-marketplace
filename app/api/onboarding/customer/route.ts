import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { phone } = await req.json()

    // Normalize: strip spaces and formatting characters before validation
    const normalized = typeof phone === "string" ? phone.trim().replace(/[\s\-().]/g, "") : ""

    // E.164 format: optional + then 7–15 digits
    if (normalized) {
      if (!/^\+?[0-9]{7,15}$/.test(normalized)) {
        return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
      }
    }

    await db
      .update(users)
      .set({
        phone: normalized || null,
        gdprConsentAt: new Date(),
      })
      .where(eq(users.id, userId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[onboarding/customer POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
