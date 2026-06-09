"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Globe, EyeOff } from "lucide-react"

type Post = {
  id: string
  title: string
  slug: string
  status: "draft" | "published"
  publishedAt: Date | string | null
  author: { firstName: string | null; lastName: string | null } | null
}

function fmt(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function AdminBlogList({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [busy, setBusy] = useState<string | null>(null)

  async function togglePublish(id: string) {
    setBusy(id)
    const res = await fetch(`/api/admin/blog/${id}/publish`, { method: "PATCH" })
    setBusy(null)
    if (!res.ok) return
    const { published } = await res.json()
    setPosts((p) =>
      p.map((post) =>
        post.id === id
          ? { ...post, status: published ? "published" : "draft", publishedAt: published ? new Date() : null }
          : post
      )
    )
  }

  async function deletePost(id: string) {
    if (!confirm("Delete this article? This cannot be undone.")) return
    setBusy(id)
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" })
    setBusy(null)
    setPosts((p) => p.filter((post) => post.id !== id))
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E5EBF0] bg-[#F8FAFB]">
            <th className="text-left px-5 py-3 font-semibold text-[#2B3441]">Title</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Status</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Author</th>
            <th className="text-left px-4 py-3 font-semibold text-[#2B3441]">Published</th>
            <th className="text-right px-5 py-3 font-semibold text-[#2B3441]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5EBF0]">
          {posts.map((post) => {
            const authorName =
              [post.author?.firstName, post.author?.lastName].filter(Boolean).join(" ") || "—"
            const isLoading = busy === post.id
            return (
              <tr key={post.id} className="hover:bg-[#F8FAFB] transition-colors">
                <td className="px-5 py-3 max-w-xs">
                  <p className="font-medium text-[#2B3441] truncate">{post.title}</p>
                  <p className="text-xs text-[#9CA3AF] truncate">/blog/{post.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      post.status === "published"
                        ? "bg-[#EDF5F0] text-[#2D7A5F] border-[#2D7A5F]/20 hover:bg-[#EDF5F0]"
                        : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }
                    variant="outline"
                  >
                    {post.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[#6B7280]">{authorName}</td>
                <td className="px-4 py-3 text-[#6B7280]">{fmt(post.publishedAt)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => togglePublish(post.id)}
                      disabled={isLoading}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      {post.status === "published" ? <EyeOff size={12} /> : <Globe size={12} />}
                      {post.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Link
                      href={`/admin/content/blog/${post.id}/edit`}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#6B7280] hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={12} />
                    </Link>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deletePost(post.id)}
                      disabled={isLoading}
                      className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
          {posts.length === 0 && (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-[#9CA3AF]">
                No articles yet. Create your first one!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
