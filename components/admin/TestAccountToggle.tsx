"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FlaskConical, Loader2 } from "lucide-react"
import { toast } from "sonner"

/**
 * Marks an account as a test account.
 *
 * A flagged account may bid on, and be booked for, its own jobs — so the platform can be tested end
 * to end without hiring a real person to play the other side. It lifts exactly three checks on the
 * job board: same person, same internet connection, and the distance limit. Payment, identity and
 * payout rules are untouched, because those are the things being tested.
 *
 * Deliberately loud. An account that can bypass anti-fraud checks must never be mistaken for an
 * ordinary one, so it is labelled wherever it appears and its bookings are kept out of revenue.
 */
export function TestAccountToggle({
  userId,
  initialValue,
  email,
}: {
  userId: string
  initialValue: boolean
  email: string
}) {
  const router = useRouter()
  const [on, setOn] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !on
    if (next && !confirm(
      `Make ${email} a TEST account?\n\nIt will be able to bid on and be booked for its own jobs, ` +
      `ignoring the same-person, same-connection and distance checks.\n\n` +
      `Payments are still REAL — a test booking charges a real card.`
    )) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/test-account`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTestAccount: next }),
      })
      if (res.ok) {
        setOn(next)
        toast.success(next ? "Now a test account" : "No longer a test account")
        router.refresh()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "Could not change this")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      role="switch"
      aria-checked={on}
      aria-label={`Test account for ${email}`}
      title={on
        ? "This account can bid on its own jobs. Click to turn off."
        : "Let this account bid on its own jobs, for testing."}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 disabled:opacity-50 ${
        on
          ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
      {on ? "TEST" : "Make test"}
    </button>
  )
}
