"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

export function SyncUsersButton() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch("/api/admin/users/sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Sync failed")
        return
      }
      const created = (data as { created: number }).created
      if (created > 0) {
        toast.success(`Synced ${created} new user${created === 1 ? "" : "s"} from Clerk`, {
          description: "Sign-ups that were missing from the database have been added.",
        })
        router.refresh()
      } else {
        toast.success("Already up to date", {
          description: "Every Clerk user is present in the database.",
        })
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-[#E5EDE9] bg-white text-[#2B3441] hover:bg-[#F4FAF6] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
      {syncing ? "Syncing…" : "Sync from Clerk"}
    </button>
  )
}
