import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
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

  return NextResponse.json({ success: true, role })
}
