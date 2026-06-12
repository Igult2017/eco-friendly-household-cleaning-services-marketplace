export const dynamic = "force-dynamic"

import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import Link from "next/link"
import { PlusCircle } from "lucide-react"
import { AdminBlogList } from "@/components/admin/blog/AdminBlogList"

async function getPosts() {
  return db.query.blogPosts.findMany({
    with: { author: { columns: { firstName: true, lastName: true } } },
    orderBy: [desc(blogPosts.createdAt)],
  })
}

export default async function AdminBlogPage() {
  const posts = await getPosts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Blog</h1>
          <p className="text-sm text-[#6B7280] mt-1">{posts.length} article{posts.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          href="/admin/content/blog/new"
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#2D7A5F] text-white hover:bg-[#235f49] transition-colors"
        >
          <PlusCircle size={16} /> New article
        </Link>
      </div>
      <AdminBlogList initialPosts={posts} />
    </div>
  )
}
