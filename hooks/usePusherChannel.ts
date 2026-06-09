"use client"

import { useEffect, useRef } from "react"
import { getPusherClient } from "@/lib/pusher/client"
import type { Channel } from "pusher-js"

/**
 * Subscribe to a Pusher private channel and bind event handlers.
 * Handlers are read through a ref so callers never need to stabilise them —
 * each incoming event always invokes the latest closure, not the one from mount.
 * Automatically unbinds and unsubscribes on unmount or channelName change.
 */
export function usePusherChannel(
  channelName: string,
  events: Record<string, (data: unknown) => void>
) {
  const channelRef = useRef<Channel | null>(null)
  // Bug 10: keep a ref to the latest events object so handlers never close over stale state
  const eventsRef = useRef(events)
  eventsRef.current = events  // sync on every render without triggering the effect

  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(channelName)
    channelRef.current = channel

    // Bind stable wrappers that delegate to eventsRef.current — stale closure eliminated
    const boundHandlers: Record<string, (data: unknown) => void> = {}
    Object.keys(eventsRef.current).forEach((eventName) => {
      boundHandlers[eventName] = (data: unknown) => eventsRef.current[eventName]?.(data)
      channel.bind(eventName, boundHandlers[eventName])
    })

    return () => {
      Object.keys(boundHandlers).forEach((eventName) => {
        channel.unbind(eventName, boundHandlers[eventName])
      })
      pusher.unsubscribe(channelName)
    }
  }, [channelName])

  return channelRef.current
}
