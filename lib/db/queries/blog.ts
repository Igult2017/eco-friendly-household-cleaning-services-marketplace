import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export async function getPublishedPosts(opts: { category?: string; limit: number; offset: number }) {
  return db.query.blogPosts.findMany({
    where: opts.category
      ? (t, { and: a, eq: e }) => a(e(t.status, "published"), e(t.category, opts.category!))
      : (t, { eq: e }) => e(t.status, "published"),
    with: { author: { columns: { firstName: true, lastName: true } } },
    orderBy: [desc(blogPosts.publishedAt)],
    limit: opts.limit,
    offset: opts.offset,
  })
}

export async function getBlogCategories() {
  const rows = await db
    .select({ category: blogPosts.category })
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
  return [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[]
}
