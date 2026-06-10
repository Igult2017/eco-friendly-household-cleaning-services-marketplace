import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { roleSelectionSchema } from "@/lib/validations/provider"

const ROLE_COOKIE = "dorix_role"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = roleSelectionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { role } = parsed.data

    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)

    await clerk.users.updateUser(userId, { publicMetadata: { role } })

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        avatarUrl: clerkUser.imageUrl,
        role,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { role, updatedAt: new Date() },
      })

    const res = NextResponse.json({ success: true, role })
    res.cookies.set(ROLE_COOKIE, `${userId}:${role}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    return res
  } catch (err) {
    console.error("[onboarding/role POST]", err)
    return NextResponse.json({ error: "Failed to set role. Please try again." }, { status: 500 })
  }
}
