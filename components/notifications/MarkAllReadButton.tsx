"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function MarkAllReadButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const markAll = async () => {
    setLoading(true)
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "all" }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={markAll}
      disabled={loading}
      className="text-xs border-[#2D7A5F] text-[#2D7A5F] hover:bg-[#F4FAF6]"
    >
      {loading ? "Marking…" : "Mark all as read"}
    </Button>
  )
}
