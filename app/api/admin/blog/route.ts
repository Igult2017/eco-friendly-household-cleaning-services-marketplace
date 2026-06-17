import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts, users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"

const blogSchema = z.object({
  title: z.string().min(3).max(300),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  excerpt: z.string().max(500).optional(),
  content: z.string(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  allowComments: z.boolean().default(true),
  allowSharing: z.boolean().default(true),
  readTimeMinutes: z.number().int().min(1).max(120).optional(),
})

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (user?.role !== "admin") return null
  return userId
}

export async function GET() {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const posts = await db.query.blogPosts.findMany({
      with: { author: { columns: { firstName: true, lastName: true } } },
      orderBy: [desc(blogPosts.createdAt)],
    })
    return NextResponse.json({ posts })
  } catch (err) {
    console.error("[admin/blog GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const parsed = blogSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const data = parsed.data
    const wordCount = data.content.replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean).length
    const readTime = data.readTimeMinutes ?? Math.max(1, Math.ceil(wordCount / 200))

    const [post] = await db.insert(blogPosts).values({
      ...data,
      coverImageUrl: data.coverImageUrl || null,
      authorId: adminId,
      readTimeMinutes: readTime,
    }).returning({ id: blogPosts.id, slug: blogPosts.slug })

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error("[admin/blog POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
