"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Leaf, Home } from "lucide-react"

export function SwitchNotifier() {
  const t = useTranslations("compLayoutSwitchNotifier")

  useEffect(() => {
    let role: string | null = null
    try { role = sessionStorage.getItem("dorix_switched_to") } catch {}
    if (!role) return
    try { sessionStorage.removeItem("dorix_switched_to") } catch {}

    if (role === "provider") {
      toast.success(t("switchedToCleanerTitle"), {
        description: t("switchedToCleanerDescription"),
        icon: <Leaf size={16} className="text-[#2D7A5F]" />,
        duration: 4000,
      })
    } else if (role === "customer") {
      toast.success(t("switchedToProviderTitle"), {
        description: t("switchedToProviderDescription"),
        icon: <Home size={16} className="text-[#2B3441]" />,
        duration: 4000,
      })
    }
  }, [t])

  return null
}
