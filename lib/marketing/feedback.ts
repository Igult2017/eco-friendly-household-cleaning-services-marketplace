import { db } from "@/lib/db"
import { emailSends } from "@/lib/db/schema"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// What Resend tells us happened to an email after we handed it over, mapped to our own status.
// Everything before this existed only as far as "we handed it to Resend" — delivered/opened/bounced
// were declared in the enum but nothing ever wrote them.
const EVENT_STATUS = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
} as const

export type ResendEventType = keyof typeof EVENT_STATUS

// Webhooks arrive out of order — an "opened" can land before its "delivered". Ranking the happy
// path means a late-arriving earlier event can never drag a status backwards.
const RANK: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4,
}

// Bad outcomes always win regardless of what came before: an email that bounced or was reported as
// spam is the truth about that send, even if an "opened" arrived first.
const TERMINAL = new Set(["bounced", "complained"])

export function isHandledEvent(type: string): type is ResendEventType {
  return type in EVENT_STATUS
}

/**
 * Record one Resend event against the send it belongs to.
 *
 * Returns what happened so the route can log it. Unknown message ids are normal and not an error:
 * transactional emails (booking confirmations, receipts) go out through the same Resend account but
 * are not tracked in email_sends, so their events legitimately match nothing here.
 */
export async function applyEmailEvent(params: {
  type: ResendEventType
  messageId: string
  bounceType?: string
}): Promise<"updated" | "ignored_older" | "unknown_message"> {
  const next = EVENT_STATUS[params.type]

  const [row] = await db
    .select({ id: emailSends.id, status: emailSends.status, userId: emailSends.userId })
    .from(emailSends)
    .where(eq(emailSends.resendMessageId, params.messageId))
    .limit(1)

  if (!row) return "unknown_message"

  const isTerminal = TERMINAL.has(next)
  const movesForward = (RANK[next] ?? -1) > (RANK[row.status] ?? -1)
  // Never overwrite a terminal state with a later happy-path event either.
  if (!isTerminal && (TERMINAL.has(row.status) || !movesForward)) return "ignored_older"

  await db.update(emailSends).set({ status: next }).where(eq(emailSends.id, row.id))

  // Someone who marked us as spam, or whose address is permanently dead, must stop receiving
  // marketing — a legal expectation as much as a deliverability one, and continuing to send to
  // either is what gets a sending domain blocked. A soft/temporary bounce (a full mailbox, a server
  // briefly down) is NOT a reason to unsubscribe anyone, so only permanent ones count. When Resend
  // does not tell us which kind it was, treat it as temporary and leave consent alone.
  const permanentlyUndeliverable =
    next === "bounced" && (params.bounceType ?? "").toLowerCase().includes("permanent")

  if (next === "complained" || permanentlyUndeliverable) {
    await db.update(users).set({ marketingConsent: false }).where(eq(users.id, row.userId))
  }

  return "updated"
}
