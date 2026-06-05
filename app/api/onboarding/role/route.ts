import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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

  const clerk = await clerkClient()
  await clerk.users.updateUser(userId, {
    publicMetadata: { role },
  })

  await db
    .update(users)
    .set({ role })
    .where(eq(users.id, userId))

  return NextResponse.json({ success: true, role })
}
