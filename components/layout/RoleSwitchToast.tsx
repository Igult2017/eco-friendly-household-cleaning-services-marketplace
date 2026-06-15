"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { Leaf, Home } from "lucide-react"

const KEY = "dorix_switch_toast"

// Shows the "Switched to X" toast on the DESTINATION page after a role switch.
// Firing the toast before navigating races the route-group transition and the
// notification is often lost; stashing it and replaying it here is reliable.
export function RoleSwitchToast() {
  const pathname = usePathname()

  useEffect(() => {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return
    sessionStorage.removeItem(KEY)
    try {
      const { title, description, role } = JSON.parse(raw) as {
        title: string
        description: string
        role: "customer" | "provider"
      }
      const Icon = role === "provider" ? Leaf : Home
      toast.success(title, {
        description,
        icon: <Icon size={16} className="text-[#2D7A5F]" />,
        duration: 5000,
      })
    } catch {
      /* ignore malformed payload */
    }
  }, [pathname])

  return null
}
