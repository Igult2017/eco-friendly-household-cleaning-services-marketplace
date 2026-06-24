import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function requireAdmin() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return null
  // Admin is a Clerk publicMetadata role — NOT the DB role (which is the onboarding role).
  let role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (!role) {
    try {
      const clerk = await clerkClient()
      const u = await clerk.users.getUser(userId)
      role = (u.publicMetadata as { role?: string })?.role
    } catch {
      return null
    }
  }
  return role === "admin" ? userId : null
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const [post] = await db.select({ status: blogPosts.status }).from(blogPosts).where(eq(blogPosts.id, id))
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const nowPublished = post.status === "draft"
    await db.update(blogPosts).set({
      status: nowPublished ? "published" : "draft",
      publishedAt: nowPublished ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(blogPosts.id, id))

    return NextResponse.json({ published: nowPublished })
  } catch (err) {
    console.error("[admin/blog/[id]/publish PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
