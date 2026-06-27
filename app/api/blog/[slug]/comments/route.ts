import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts, blogComments, users } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { z } from "zod"
import { createRateLimiter, safeLimit } from "@/lib/redis/client"
import { logError } from "@/lib/utils/logError"

export const dynamic = "force-dynamic"

// M4: throttle comment creation (anti-spam). Comments still auto-approve + show immediately.
const commentRatelimit = createRateLimiter({ tokens: 5, windowSeconds: 3600, prefix: "ratelimit:comment" })

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const [post] = await db.select({ id: blogPosts.id }).from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const comments = await db.query.blogComments.findMany({
      where: (c, { and: a, eq: eqFn }) => a(eqFn(c.postId, post.id), eqFn(c.isApproved, true)),
      with: { user: { columns: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: [desc(blogComments.createdAt)],
      limit: 100,
    })

    return NextResponse.json({ comments })
  } catch (err) {
    console.error("[blog/[slug]/comments GET]", err)
    void logError({ message: "[blog/[slug]/comments GET]", error: err, route: "/api/blog/[slug]/comments", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 })

    const { success } = await safeLimit(commentRatelimit, userId)
    if (!success) return NextResponse.json({ error: "Too many comments. Please wait before posting again." }, { status: 429 })

    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = z.object({ body: z.string().min(2).max(1000) }).safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const [post] = await db.select({ id: blogPosts.id, allowComments: blogPosts.allowComments }).from(blogPosts)
      .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published")))

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!post.allowComments) return NextResponse.json({ error: "Comments are disabled" }, { status: 403 })

    const [comment] = await db.insert(blogComments)
      .values({ postId: post.id, userId, body: parsed.data.body })
      .returning({ id: blogComments.id, createdAt: blogComments.createdAt })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    console.error("[blog/[slug]/comments POST]", err)
    void logError({ message: "[blog/[slug]/comments POST]", error: err, route: "/api/blog/[slug]/comments", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
