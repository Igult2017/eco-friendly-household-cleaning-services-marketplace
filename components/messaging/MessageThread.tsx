"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePusherChannel } from "@/hooks/usePusherChannel"
import { Send, Loader2 } from "lucide-react"

interface Message {
  id: string
  senderId: string
  body: string
  createdAt: string
  isRead: boolean
}

interface Props {
  bookingId: string
  currentUserId: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function MessageThread({ bookingId, currentUserId }: Props) {
  const queryClient = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ["messages", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/messages`)
      if (!res.ok) throw new Error("Failed to load messages")
      return res.json() as Promise<{ messages: Message[] }>
    },
    refetchInterval: 5000,
  })

  const messages = data?.messages ?? []

  function handleNewMessage() {
    queryClient.invalidateQueries({ queryKey: ["messages", bookingId] })
  }

  usePusherChannel(`private-booking-${bookingId}`, {
    "new-message": handleNewMessage,
  })

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        setSendError(json.error ?? "Failed to send message")
        return
      }
      setBody("")
      queryClient.invalidateQueries({ queryKey: ["messages", bookingId] })
    } catch {
      setSendError("Something went wrong. Please try again.")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Group messages by date for separators
  let lastDate = ""

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] bg-white rounded-2xl border border-[#E5EBF0] shadow-sm overflow-hidden">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-[#2D7A5F]" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#9CA3AF] text-sm text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const dateLabel = formatDate(msg.createdAt)
          const showDateSep = dateLabel !== lastDate
          lastDate = dateLabel
          const isOwn = msg.senderId === currentUserId

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-[#E5EBF0]" />
                  <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{dateLabel}</span>
                  <div className="flex-1 h-px bg-[#E5EBF0]" />
                </div>
              )}
              <div
                className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}
              >
                <div className="max-w-[75%]">
                  <div
                    className={
                      isOwn
                        ? "bg-[#2D7A5F] text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm leading-relaxed"
                        : "bg-[#F4FAF6] text-[#2B3441] rounded-2xl rounded-tl-sm px-4 py-2 text-sm leading-relaxed"
                    }
                  >
                    {msg.body}
                  </div>
                  <p
                    className={`text-xs text-[#9CA3AF] mt-0.5 ${
                      isOwn ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-[#E5EBF0] px-4 py-3 bg-white">
        {sendError && (
          <p className="text-red-500 text-xs mb-2">{sendError}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-[#E5EBF0] bg-[#F4FAF6] px-4 py-2.5 text-sm text-[#2B3441] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2D7A5F] focus:ring-1 focus:ring-[#2D7A5F] transition-colors max-h-32 overflow-y-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="shrink-0 w-10 h-10 rounded-xl bg-[#2D7A5F] hover:bg-[#256349] disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
