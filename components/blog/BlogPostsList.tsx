"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BlogPostCard, type BlogPostCardPost } from "@/components/blog/BlogPostCard"
import { BLOG_PAGE_SIZE } from "@/lib/blog/constants"

export function BlogPostsList({
  initialPosts,
  initialHasMore,
  category,
}: {
  initialPosts: BlogPostCardPost[]
  initialHasMore: boolean
  category?: string
}) {
  const t = useTranslations("blog")
  const [posts, setPosts] = useState(initialPosts)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ offset: String(posts.length), limit: String(BLOG_PAGE_SIZE) })
      if (category) params.set("category", category)
      const res = await fetch(`/api/blog/posts?${params}`)
      const data = res.ok ? await res.json() : null
      setPosts((prev) => [...prev, ...(data?.posts ?? [])])
      setHasMore(!!data?.hasMore)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-10">
          <Button
            onClick={loadMore}
            disabled={loading}
            className="h-11 px-6 bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? t("loadingMore") : t("loadMore")}
          </Button>
        </div>
      )}
    </>
  )
}
