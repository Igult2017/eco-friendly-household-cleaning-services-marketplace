import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { z } from "zod"
import { sanitizeBlogHtml } from "@/lib/security/sanitize"
import { logError } from "@/lib/utils/logError"

const blogSchema = z.object({
  title: z.string().min(3).max(300),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens"),
  excerpt: z.string().max(500).optional(),
  content: z.string(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  authorName: z.string().max(160).optional().or(z.literal("")),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  allowComments: z.boolean().default(true),
  allowSharing: z.boolean().default(true),
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
    void logError({ message: "[admin/blog GET]", error: err, route: "/api/admin/blog", severity: "error" })
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
      content: sanitizeBlogHtml(data.content), // strip XSS at rest (H1)
      coverImageUrl: data.coverImageUrl || null,
      authorName: data.authorName || null,
      authorId: adminId,
      readTimeMinutes: readTime,
    }).returning({ id: blogPosts.id, slug: blogPosts.slug })

    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error("[admin/blog POST]", err)
    void logError({ message: "[admin/blog POST]", error: err, route: "/api/admin/blog", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
