"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, LifeBuoy } from "lucide-react"

type Thread = { userId: string; name: string; email: string | null; role: string | null; lastBody: string; lastAt: string; unread: number }

// Admin support inbox — one row per user thread, unread-from-user counts, newest first.
export default function AdminSupportPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () =>
      fetch("/api/admin/support")
        .then((r) => r.json())
        .then((d) => setThreads(d.threads ?? []))
        .finally(() => setLoading(false))
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-[#2B3441] mb-1 flex items-center gap-2"><LifeBuoy size={22} className="text-[#2D7A5F]" /> Support</h1>
      <p className="text-sm text-[#6B7280] mb-6">Conversations with clients and cleaners. Replies notify them in-app and by email.</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#2D7A5F]" /></div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E5EBF0] p-12 text-center text-[#6B7280]">No support messages yet.</div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#E5EBF0] divide-y divide-[#F0F4F8] overflow-hidden">
          {threads.map((th) => (
            <Link key={th.userId} href={`/admin/support/${th.userId}`} className="flex items-center gap-3 px-5 py-4 hover:bg-[#F4FAF6] transition-colors">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2D7A5F]/10 text-[#2D7A5F] font-semibold">
                {(th.name[0] ?? "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#2B3441] truncate">
                    {th.name}
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-[#6B7280]">{th.role ?? "user"}</span>
                  </p>
                  <span className="text-[11px] text-[#9CA3AF] shrink-0">{new Date(th.lastAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className={`text-sm truncate ${th.unread > 0 ? "text-[#2B3441] font-medium" : "text-[#6B7280]"}`}>{th.lastBody}</p>
              </div>
              {th.unread > 0 && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#2D7A5F] px-1.5 text-[11px] font-bold text-white">{th.unread}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
