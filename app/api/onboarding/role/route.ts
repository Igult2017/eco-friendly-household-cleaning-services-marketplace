import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const ROLE_COOKIE = "dorix_role"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { roleSelectionSchema } from "@/lib/validations/provider"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = roleSelectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { role } = parsed.data

  // Fetch the Clerk user so we can upsert a DB row if the webhook missed it
  // (e.g. duplicate-email conflict swallowed the user.created event).
  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)

  await clerk.users.updateUser(userId, { publicMetadata: { role } })

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""

  // Upsert: creates the row if the webhook never did, updates role either way.
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

  // Set an HttpOnly cookie so the middleware can read the role immediately,
  // before Clerk refreshes the JWT (which has a ~60s TTL).
  const res = NextResponse.json({ success: true, role })
  res.cookies.set(ROLE_COOKIE, `${userId}:${role}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
  return res
}
