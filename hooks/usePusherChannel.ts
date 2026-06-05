"use client"

import { useEffect, useRef } from "react"
import { getPusherClient } from "@/lib/pusher/client"
import type { Channel } from "pusher-js"

/**
 * Subscribe to a Pusher private channel and bind event handlers.
 * Automatically unbinds and unsubscribes on unmount.
 */
export function usePusherChannel(
  channelName: string,
  events: Record<string, (data: unknown) => void>
) {
  const channelRef = useRef<Channel | null>(null)

  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(channelName)
    channelRef.current = channel

    Object.entries(events).forEach(([event, handler]) => {
      channel.bind(event, handler)
    })

    return () => {
      Object.keys(events).forEach((event) => channel.unbind(event))
      pusher.unsubscribe(channelName)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName])

  return channelRef.current
}
