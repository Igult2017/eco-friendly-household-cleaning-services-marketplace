import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  authorName: z.string().max(160).optional().or(z.literal("")),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  allowComments: z.boolean().optional(),
  allowSharing: z.boolean().optional(),
  readTimeMinutes: z.number().int().min(1).max(120).optional(),
})

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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data
    if (data.content) {
      const wordCount = data.content.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length
      if (!data.readTimeMinutes) data.readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200))
    }

    await db.update(blogPosts).set({
      ...data,
      coverImageUrl: data.coverImageUrl || null,
      ...(data.authorName !== undefined ? { authorName: data.authorName || null } : {}),
      updatedAt: new Date(),
    }).where(eq(blogPosts.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/blog/[id] PUT]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    await db.delete(blogPosts).where(eq(blogPosts.id, id))
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/blog/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
