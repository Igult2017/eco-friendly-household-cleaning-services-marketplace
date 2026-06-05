"use client"

import { useState } from "react"
import { CheckCircle, Loader2 } from "lucide-react"

export function ErrorResolveButton({ id, onResolved }: { id: string; onResolved: () => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function resolve() {
    setLoading(true)
    try {
      await fetch(`/api/admin/errors/${id}/resolve`, { method: "POST" })
      setDone(true)
      onResolved()
    } finally {
      setLoading(false)
    }
  }

  if (done) return <span className="text-xs text-[#2D7A5F] font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Resolved</span>

  return (
    <button
      onClick={resolve}
      disabled={loading}
      className="text-xs font-medium text-[#6B7280] hover:text-[#2D7A5F] transition-colors flex items-center gap-1 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
      Resolve
    </button>
  )
}
