"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  jobId: string
  bidId: string
}

export function AcceptBidButton({ jobId, bidId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/bids/${bidId}/accept`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to accept bid"); return }
      if (data.redirectTo) router.push(data.redirectTo)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        onClick={handleAccept}
        disabled={loading}
        size="sm"
        className="mt-1 h-7 text-xs bg-[#2D7A5F] hover:bg-[#235f49] text-white"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : "Accept"}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
