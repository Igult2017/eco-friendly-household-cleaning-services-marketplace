"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[AdminError]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="font-serif text-xl font-bold text-[#2B3441] mb-2">Something went wrong</h2>
        <p className="text-sm text-[#6B7280] leading-relaxed">
          This page failed to load. This is usually a temporary database issue — try refreshing.
          {error.digest && (
            <span className="block mt-2 font-mono text-xs text-[#9CA3AF]">Digest: {error.digest}</span>
          )}
        </p>
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white text-sm font-semibold transition-colors"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  )
}
