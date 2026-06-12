export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"
import { BlogPostCard } from "@/components/blog/BlogPostCard"
import { Rss } from "lucide-react"

export const metadata: Metadata = {
  title: "Blog — DORIXÉ",
  description: "Tips, news and eco-friendly insights from the DORIXÉ team.",
}

async function getPosts(category?: string) {
  return db.query.blogPosts.findMany({
    where: category
      ? (t, { and: a, eq: e }) => a(e(t.status, "published"), e(t.category, category))
      : (t, { eq: e }) => e(t.status, "published"),
    with: { author: { columns: { firstName: true, lastName: true } } },
    orderBy: [desc(blogPosts.publishedAt)],
  })
}

async function getCategories() {
  const rows = await db
    .select({ category: blogPosts.category })
    .from(blogPosts)
    .where(eq(blogPosts.status, "published"))
  return [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[]
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const [posts, categories] = await Promise.all([getPosts(category), getCategories()])

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <Rss size={18} className="text-[#2D7A5F]" />
            <span className="text-xs font-semibold text-[#2D7A5F] uppercase tracking-widest">Blog</span>
          </div>
          <h1 className="font-serif text-4xl font-bold text-[#2B3441]">Clean home. Green future.</h1>
          <p className="text-[#6B7280] mt-2 text-lg">Tips, guides and eco insights from the DORIXÉ team.</p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <a
              href="/blog"
              className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                !category ? "bg-[#2D7A5F] text-white" : "bg-white text-[#6B7280] border border-[#E5EBF0] hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
              }`}
            >
              All
            </a>
            {categories.map((cat) => (
              <a
                key={cat}
                href={`/blog?category=${encodeURIComponent(cat)}`}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition-colors ${
                  category === cat ? "bg-[#2D7A5F] text-white" : "bg-white text-[#6B7280] border border-[#E5EBF0] hover:border-[#2D7A5F] hover:text-[#2D7A5F]"
                }`}
              >
                {cat}
              </a>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-20 text-[#9CA3AF]">
            <p className="text-lg font-medium mb-1">No articles yet</p>
            <p className="text-sm">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
