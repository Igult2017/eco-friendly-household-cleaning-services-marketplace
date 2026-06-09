import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const [post] = await db.query.blogPosts.findMany({
    where: (p, { and: a, eq: eqFn }) => a(eqFn(p.slug, slug), eqFn(p.status, "published")),
    with: { author: { columns: { firstName: true, lastName: true, avatarUrl: true } } },
    limit: 1,
  })

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ post })
}
