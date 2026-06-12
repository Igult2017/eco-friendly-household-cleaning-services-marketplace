"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { Leaf, Home } from "lucide-react"

export function SwitchNotifier() {
  useEffect(() => {
    let role: string | null = null
    try { role = sessionStorage.getItem("dorix_switched_to") } catch {}
    if (!role) return
    try { sessionStorage.removeItem("dorix_switched_to") } catch {}

    if (role === "provider") {
      toast.success("Switched to Cleaner Account", {
        description: "You are now browsing as a cleaner. Find and bid on nearby jobs.",
        icon: <Leaf size={16} className="text-[#2D7A5F]" />,
        duration: 4000,
      })
    } else if (role === "customer") {
      toast.success("Switched to Provider Account", {
        description: "You are now browsing as a provider. Post jobs and manage bookings.",
        icon: <Home size={16} className="text-[#2B3441]" />,
        duration: 4000,
      })
    }
  }, [])

  return null
}
