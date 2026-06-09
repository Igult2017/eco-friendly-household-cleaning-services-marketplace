import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts, blogComments, users } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { z } from "zod"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
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
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 })

  const { slug } = await params
  const body = await req.json()
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
}
