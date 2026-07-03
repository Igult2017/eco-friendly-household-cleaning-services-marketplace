"use client"

import { useEffect } from "react"
import { pingUnread } from "@/hooks/useUnread"

// Mounted by pages that mark notifications read server-side (e.g. the notifications page marks
// everything read on open) — tells every badge on the page to refetch immediately.
export function PingUnread() {
  useEffect(() => { pingUnread() }, [])
  return null
}
