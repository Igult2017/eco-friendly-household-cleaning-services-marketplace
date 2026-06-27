import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const [post] = await db.query.blogPosts.findMany({
      where: (p, { and: a, eq: eqFn }) => a(eqFn(p.slug, slug), eqFn(p.status, "published")),
      with: { author: { columns: { firstName: true, lastName: true, avatarUrl: true } } },
      limit: 1,
    })

    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    console.error("[blog/[slug] GET]", err)
    void logError({ message: "[blog/[slug] GET]", error: err, route: "/api/blog/[slug]", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
