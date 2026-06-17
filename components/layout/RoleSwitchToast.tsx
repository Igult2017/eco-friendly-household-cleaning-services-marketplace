"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Leaf, Home } from "lucide-react"

const KEY = "dorix_switch_toast"
const MAX_AGE_MS = 15_000 // RSN-006: ignore stale entries from a switch that never completed

// Shows the "Switched to X" toast on the DESTINATION page after a role switch.
// Firing the toast before navigating races the route-group transition and the
// notification is often lost; stashing the role and replaying it here is reliable.
export function RoleSwitchToast() {
  const pathname = usePathname()
  const t = useTranslations("compLayoutRoleSwitcher")

  useEffect(() => {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return
    sessionStorage.removeItem(KEY)
    try {
      const { role, ts } = JSON.parse(raw) as { role: "customer" | "provider"; ts?: number }
      // RSN-006: a stale entry (e.g. switch that crashed before navigating) must not fire
      // a ghost toast on some unrelated later navigation.
      if (typeof ts !== "number" || Date.now() - ts > MAX_AGE_MS) return
      if (role !== "customer" && role !== "provider") return

      const isProvider = role === "provider"
      // RSN-005: translate here so the toast is in the CURRENT locale even if the user
      // changed language between clicking switch and landing on the destination page.
      const title = isProvider ? t("toastTitleCleaner") : t("toastTitleCustomer")
      const description = isProvider ? t("toastDescCleaner") : t("toastDescCustomer")
      // RSN-004: icon colour follows the target role — green for cleaner, dark for customer.
      const Icon = isProvider ? Leaf : Home
      const colorClass = isProvider ? "text-[#2D7A5F]" : "text-[#2B3441]"

      toast.success(title, {
        id: "role-switch", // same id as the immediate toast → sonner shows one, not two
        description,
        icon: <Icon size={16} className={colorClass} />,
        duration: 5000,
      })
    } catch {
      /* ignore malformed payload */
    }
  }, [pathname, t])

  return null
}
