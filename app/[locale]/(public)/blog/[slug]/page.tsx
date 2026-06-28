export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { auth } from "@clerk/nextjs/server"
import { BlogContent } from "@/components/blog/BlogContent"
import { ShareButtons } from "@/components/blog/ShareButtons"
import { BlogComments } from "@/components/blog/BlogComments"
import { Clock, Tag, ChevronLeft } from "lucide-react"
import { JsonLd } from "@/components/seo/JsonLd"
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schemas"

async function getPost(slug: string) {
  const post = await db.query.blogPosts.findFirst({
    where: (t, { and, eq }) => and(eq(t.slug, slug), eq(t.status, "published")),
    with: { author: { columns: { firstName: true, lastName: true } } },
  })
  return post ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: "Not found" }
  return {
    title: `${post.title} — DORIXÉ Blog`,
    description: post.excerpt ?? undefined,
    openGraph: post.coverImageUrl ? { images: [post.coverImageUrl] } : undefined,
  }
}

function formatDate(d: Date | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [post, { userId }] = await Promise.all([getPost(slug), auth()])
  if (!post) notFound()

  const authorName =
    post.authorName?.trim() ||
    [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") ||
    "DORIXÉ Team"
  const postUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/blog/${post.slug}`

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <JsonLd
        data={[
          articleSchema({
            slug: post.slug,
            title: post.title,
            excerpt: post.excerpt,
            coverImageUrl: post.coverImageUrl,
            authorName,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
            category: post.category,
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] mb-8">
          <ChevronLeft size={14} /> Back to blog
        </Link>

        {post.coverImageUrl && (
          <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden mb-8">
            <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" priority unoptimized={post.coverImageUrl.includes("/api/files")} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-[#6B7280]">
          {post.category && (
            <span className="inline-flex items-center gap-1 text-[#2D7A5F] font-medium bg-[#EDF5F0] px-2.5 py-1 rounded-full">
              <Tag size={11} /> {post.category}
            </span>
          )}
          {post.readTimeMinutes && (
            <span className="flex items-center gap-1"><Clock size={13} /> {post.readTimeMinutes} min read</span>
          )}
          <span>{authorName}</span>
          <span>·</span>
          <span>{formatDate(post.publishedAt)}</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2B3441] leading-tight mb-4">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg text-[#6B7280] leading-relaxed mb-8 border-l-4 border-[#4CB87A] pl-4">
            {post.excerpt}
          </p>
        )}

        {post.allowSharing && (
          <div className="mb-8">
            <ShareButtons url={postUrl} title={post.title} />
          </div>
        )}

        <BlogContent html={post.content} />

        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[#E5EBF0]">
            {(post.tags as string[]).map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white border border-[#E5EBF0] text-[#6B7280]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {post.allowComments && <BlogComments slug={post.slug} isSignedIn={!!userId} />}
      </div>
    </div>
  )
}
