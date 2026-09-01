"use client"

import { useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ShieldAlert } from "lucide-react"

// One entry per `denied=` value a redirect can attach (middleware.ts's 4 role-mismatch redirects,
// plus the 2 dual-role "wrong active view" redirects in app/(provider)/layout.tsx and
// app/(customer)/layout.tsx). Explicit lookup rather than string-transforming the reason into a key
// name, so a typo in either place fails obviously instead of silently missing a translation.
const REASON_KEYS: Record<string, { title: string; body: string }> = {
  admin: { title: "adminTitle", body: "adminBody" },
  affiliate: { title: "affiliateTitle", body: "affiliateBody" },
  provider: { title: "providerTitle", body: "providerBody" },
  customer: { title: "customerTitle", body: "customerBody" },
  "provider-switch": { title: "providerSwitchTitle", body: "providerSwitchBody" },
  "customer-switch": { title: "customerSwitchTitle", body: "customerSwitchBody" },
  // An admin trying to reach a client-only page (e.g. Post a Job) — distinct from the generic
  // "customer" reason because an admin account can never itself become a client account (unlike a
  // dual-role account, which just switches between its own two views), so the advice is different.
  "admin-customer": { title: "adminCustomerTitle", body: "adminCustomerBody" },
}

// Shows a clear explanation when someone lands here because middleware or a role-gated layout just
// blocked them from a page outside their role. Reuses the exact toast mechanism already proven for
// the voluntary role-switch case (RoleSwitchToast.tsx) — the difference is WHERE the trigger comes
// from: that one is set from the browser before a client-initiated navigation (sessionStorage), but
// a middleware/layout redirect happens server-side with no browser to write to sessionStorage from,
// so the reason travels as a URL param instead, read here the moment the landing page loads.
export function AccessDeniedToast() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("compLayoutAccessDeniedToast")
  const reason = searchParams.get("denied")

  useEffect(() => {
    if (!reason) return
    const keys = REASON_KEYS[reason]
    if (!keys) return

    toast.error(t(keys.title), {
      description: t(keys.body),
      icon: <ShieldAlert size={16} className="text-amber-600" />,
      duration: 6000,
    })

    // Strip just this param (preserve anything else already on the URL) so refreshing or sharing
    // the link never re-shows the same toast.
    const next = new URLSearchParams(searchParams)
    next.delete("denied")
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason])

  return null
}
