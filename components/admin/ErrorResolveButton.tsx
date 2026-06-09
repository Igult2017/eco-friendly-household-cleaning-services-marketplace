"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, Loader2, XCircle } from "lucide-react"

export function ErrorResolveButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolve() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/errors/${id}/resolve`, { method: "POST" })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      setDone(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <span className="text-xs text-[#2D7A5F] font-medium flex items-center gap-1">
      <CheckCircle className="h-3 w-3" /> Resolved
    </span>
  )

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={resolve}
        disabled={loading}
        className="text-xs font-medium text-[#6B7280] hover:text-[#2D7A5F] transition-colors flex items-center gap-1 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Resolve
      </button>
      {error && (
        <span className="text-[10px] text-red-500 flex items-center gap-0.5">
          <XCircle className="h-2.5 w-2.5" /> {error}
        </span>
      )}
    </div>
  )
}
