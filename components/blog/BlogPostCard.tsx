"use client"

import Link from "next/link"
import Image from "next/image"
import { Clock, Tag } from "lucide-react"
import { useTranslations } from "next-intl"

export type BlogPostCardPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  coverImageUrl: string | null
  authorName: string | null
  category: string | null
  readTimeMinutes: number | null
  publishedAt: Date | string | null
  author: { firstName: string | null; lastName: string | null } | null
}

function formatDate(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

// Absolute /api/files URLs need the origin stripped before <Image> will treat them as a local
// picture — a "/"-prefixed src skips the remotePatterns allow-list entirely, so this needs no
// next.config.ts change. Anything else (e.g. an Unsplash URL) is already allow-listed, left as-is.
function toImageSrc(url: string) {
  return url.includes("/api/files") ? url.replace(/^https?:\/\/[^/]+/, "") : url
}

export function BlogPostCard({ post }: { post: BlogPostCardPost }) {
  const t = useTranslations("compBlogBlogPostCard")
  const authorName =
    post.authorName?.trim() ||
    [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") ||
    t("authorFallback")
  return (
    <Link href={`/blog/${post.slug}`} className="group block bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden hover:shadow-md transition-shadow">
      {post.coverImageUrl ? (
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={toImageSrc(post.coverImageUrl)}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(min-width: 1024px) 347px, (min-width: 640px) 50vw, 100vw"
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-[#2D7A5F]/10 to-[#4CB87A]/20 flex items-center justify-center">
          <span className="text-4xl">🌿</span>
        </div>
      )}
      <div className="p-5">
        {post.category && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D7A5F] bg-[#EDF5F0] px-2 py-0.5 rounded-full mb-3">
            <Tag size={10} /> {post.category}
          </span>
        )}
        <h3 className="font-serif font-bold text-[#2B3441] text-lg leading-snug mb-2 group-hover:text-[#2D7A5F] transition-colors line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-[#6B7280] leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
          <span>{authorName} · {formatDate(post.publishedAt)}</span>
          {post.readTimeMinutes && (
            <span className="flex items-center gap-1"><Clock size={11} /> {t("readTime", { minutes: post.readTimeMinutes })}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
