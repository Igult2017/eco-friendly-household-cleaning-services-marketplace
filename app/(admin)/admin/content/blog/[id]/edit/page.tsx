export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { BlogPostForm } from "@/components/admin/blog/BlogPostForm"

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id))
  if (!post) notFound()

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <Link
        href="/admin/content/blog"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] mb-6"
      >
        <ChevronLeft size={14} /> Blog
      </Link>
      <h1 className="text-2xl font-bold text-[#2B3441] mb-6">Edit article</h1>
      <BlogPostForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? undefined,
          content: post.content,
          coverImageUrl: post.coverImageUrl ?? undefined,
          authorName: post.authorName ?? undefined,
          category: post.category ?? undefined,
          tags: (post.tags as string[]) ?? [],
          allowComments: post.allowComments,
          allowSharing: post.allowSharing,
        }}
      />
    </main>
  )
}
