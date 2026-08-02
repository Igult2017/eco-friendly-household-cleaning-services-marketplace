"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { usePusherChannel } from "@/hooks/usePusherChannel"

// Genuine realtime "first tap wins" needs more than the 30s-polling notification bell — this
// listens for the distinct take-job-available Pusher event (lib/inngest/functions/jobs.ts) and
// surfaces an immediate toast. Unlike the earlier inactivity-logout toast bug (a toast fired
// synchronously ON MOUNT, racing Sonner's <Toaster/> mount in the same commit pass — fixed by JSX
// order in app/layout.tsx), this toast only ever fires later, async, off a Pusher event — by the
// time any event can arrive the WebSocket has to connect first, so React's initial mount/commit has
// long since settled and <Toaster/> is already subscribed regardless of this component's position.
export function TakeJobAlerts() {
  const t = useTranslations("compProviderTakeJobAlerts")
  const router = useRouter()
  const [providerId, setProviderId] = useState("")
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    fetch("/api/providers/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.provider?.id) setProviderId(d.provider.id)
        setEnabled(!!d?.provider?.instantJobsAvailable)
      })
      .catch(() => {})
  }, [])

  usePusherChannel(enabled ? `private-provider-${providerId}` : "", {
    "take-job-available": (data) => {
      const payload = data as { jobPostId?: string; title?: string; city?: string }
      toast.info(t("toastTitle"), {
        description: payload.city ? t("toastBody", { city: payload.city }) : undefined,
        action: { label: t("toastAction"), onClick: () => router.push("/provider/jobs") },
        duration: 15_000,
      })
    },
  })

  return null
}
