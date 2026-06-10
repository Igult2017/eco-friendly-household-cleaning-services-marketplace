import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  return user?.role === "admin" ? userId : null
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
