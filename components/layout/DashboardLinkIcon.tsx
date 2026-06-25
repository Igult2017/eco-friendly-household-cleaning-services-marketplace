"use client"

import { useLinkStatus } from "next/link"
import { LayoutDashboard, Loader2 } from "lucide-react"

// Instant click feedback for the dashboard / Admin-panel nav link. The destination is a dynamic,
// auth-gated route with prefetch disabled, so the transition can lag while the server resolves the
// role + renders. useLinkStatus flips to pending the moment the link is clicked; we swap the icon
// for a spinner (same 15px size → no layout shift). If the route was prefetched (e.g. on hover),
// pending is skipped and this just shows the normal icon.
export function DashboardLinkIcon() {
  const { pending } = useLinkStatus()
  return pending ? (
    <Loader2 size={15} className="animate-spin" aria-hidden />
  ) : (
    <LayoutDashboard size={15} aria-hidden />
  )
}
