"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { usePusherChannel } from "@/hooks/usePusherChannel"

// Genuine realtime "first tap wins" needs more than the 30s-polling notification bell — this
// listens for the distinct take-job-available Pusher event (lib/inngest/functions/jobs.ts) and
// surfaces an immediate toast. A toast fired synchronously ON MOUNT can race Sonner's <Toaster/>
// mount in the same commit pass and be dropped (hence the JSX-order note in app/layout.tsx); this
// one is safe from that regardless of where the component sits, because it only ever fires later,
// async, off a Pusher event — the WebSocket has to connect before any event can arrive, by which
// time React's initial mount/commit has long since settled and <Toaster/> is subscribed.
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
