import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { BlogPostForm } from "@/components/admin/blog/BlogPostForm"

export default function NewBlogPostPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <Link
        href="/admin/content/blog"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#2B3441] mb-6"
      >
        <ChevronLeft size={14} /> Blog
      </Link>
      <h1 className="text-2xl font-bold text-[#2B3441] mb-6">New article</h1>
      <BlogPostForm />
    </main>
  )
}
