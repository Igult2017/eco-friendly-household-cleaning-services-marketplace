"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  bookingId: string
  status: string
}

export function ProviderBookingActions({ bookingId, status }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (status === "in_progress") {
    return (
      <a
        href={`/provider/bookings/${bookingId}/complete`}
        className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white inline-block"
      >
        Mark Complete
      </a>
    )
  }

  const actionMap: Record<string, { label: string; endpoint: string }> = {
    payment_authorized: {
      label: "Confirm Booking",
      endpoint: `/api/bookings/${bookingId}/confirm`,
    },
    confirmed: {
      label: "Start Cleaning",
      endpoint: `/api/bookings/${bookingId}/start`,
    },
  }

  const action = actionMap[status]
  if (!action) return null

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(action.endpoint, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error)
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-lg bg-[#2D7A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {loading ? "Processing…" : action.label}
    </button>
  )
}
