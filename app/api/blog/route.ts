import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "12"), 50)
    const offset = parseInt(searchParams.get("offset") ?? "0")

    const where = category
      ? and(eq(blogPosts.status, "published"), eq(blogPosts.category, category))
      : eq(blogPosts.status, "published")

    const posts = await db.query.blogPosts.findMany({
      where: () => where!,
      with: { author: { columns: { firstName: true, lastName: true, avatarUrl: true } } },
      columns: {
        id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, authorName: true,
        category: true, tags: true, readTimeMinutes: true, publishedAt: true, allowSharing: true,
      },
      orderBy: [desc(blogPosts.publishedAt)],
      limit,
      offset,
    })

    return NextResponse.json({ posts })
  } catch (err) {
    console.error("[blog GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
