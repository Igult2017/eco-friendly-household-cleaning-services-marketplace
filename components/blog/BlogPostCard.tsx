import Link from "next/link"
import Image from "next/image"
import { Clock, Tag } from "lucide-react"

type Post = {
  slug: string
  title: string
  excerpt: string | null
  coverImageUrl: string | null
  category: string | null
  readTimeMinutes: number | null
  publishedAt: Date | string | null
  author: { firstName: string | null; lastName: string | null } | null
}

function formatDate(d: Date | string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

export function BlogPostCard({ post }: { post: Post }) {
  const authorName = [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") || "DORIXÉ Team"
  return (
    <Link href={`/blog/${post.slug}`} className="group block bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden hover:shadow-md transition-shadow">
      {post.coverImageUrl ? (
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
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
            <span className="flex items-center gap-1"><Clock size={11} /> {post.readTimeMinutes} min</span>
          )}
        </div>
      </div>
    </Link>
  )
}
