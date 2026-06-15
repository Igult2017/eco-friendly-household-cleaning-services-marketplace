"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Comment = {
  id: string
  body: string
  createdAt: string
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function BlogComments({ slug, isSignedIn }: { slug: string; isSignedIn: boolean }) {
  const t = useTranslations("compBlogBlogComments")
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/blog/${slug}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
  }, [slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    setError("")
    const res = await fetch(`/api/blog/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    setSubmitting(false)
    if (res.ok) {
      setBody("")
      router.refresh()
      const data = await fetch(`/api/blog/${slug}/comments`).then((r) => r.json())
      setComments(data.comments ?? [])
    } else {
      const d = await res.json()
      setError(d.error ?? t("errorFailedToPost"))
    }
  }

  return (
    <section className="mt-12 border-t border-[#E5EBF0] pt-10">
      <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-6 flex items-center gap-2">
        <MessageSquare size={22} className="text-[#2D7A5F]" /> {t("heading", { count: comments.length })}
      </h2>

      {isSignedIn ? (
        <form onSubmit={submit} className="mb-8">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("placeholder")}
            rows={3}
            className="mb-3 border-[#E5EBF0] focus:border-[#2D7A5F] resize-none"
            maxLength={1000}
          />
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <Button type="submit" disabled={submitting || !body.trim()} className="bg-[#2D7A5F] hover:bg-[#235f49] text-white gap-2">
            <Send size={14} /> {submitting ? t("posting") : t("postComment")}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[#6B7280] mb-8 bg-[#F4FAF6] border border-[#E5EBF0] rounded-xl p-4">
          {t.rich("signInPrompt", {
            link: (chunks) => (
              <a href="/sign-in" className="text-[#2D7A5F] font-medium hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      )}

      <div className="space-y-6">
        {comments.map((c) => {
          const name = [c.user?.firstName, c.user?.lastName].filter(Boolean).join(" ") || t("anonymousReader")
          return (
            <div key={c.id} className="flex gap-3">
              {c.user?.avatarUrl ? (
                <Image src={c.user.avatarUrl} alt={name} width={36} height={36} className="rounded-full w-9 h-9 object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#EDF5F0] flex items-center justify-center flex-shrink-0 text-[#2D7A5F] font-bold text-sm">
                  {name[0]}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-[#2B3441]">{name}</span>
                  <span className="text-xs text-[#9CA3AF]">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-[#2B3441]/80 leading-relaxed">{c.body}</p>
              </div>
            </div>
          )
        })}
        {comments.length === 0 && (
          <p className="text-sm text-[#9CA3AF] text-center py-6">{t("emptyState")}</p>
        )}
      </div>
    </section>
  )
}
