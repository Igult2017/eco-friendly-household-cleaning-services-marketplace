import { db } from "@/lib/db"
import { messages, providers } from "@/lib/db/schema"
import { eq, and, lt, desc, sql } from "drizzle-orm"

// Ignore reply gaps slower than this — a week-old unanswered thread the provider finally replies to
// isn't a representative "how fast do they usually respond" data point, it would just skew the average.
const STALE_REPLY_CAP_MINUTES = 7 * 24 * 60

// Call AFTER inserting a new message. If the sender is the provider and they're replying to the OTHER
// party's most recent message in this thread, folds the reply gap into a running mean on `providers` —
// updated inline on the send path so no cron/batch job is needed to keep it current.
export async function recordProviderResponseIfApplicable(opts: {
  threadColumn: "bookingId" | "jobPostId"
  threadId: string
  senderIsProvider: boolean
  providerUserId: string
  newMessageCreatedAt: Date
}) {
  if (!opts.senderIsProvider) return
  const col = opts.threadColumn === "bookingId" ? messages.bookingId : messages.jobPostId

  const [prior] = await db
    .select({ senderId: messages.senderId, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(col, opts.threadId), lt(messages.createdAt, opts.newMessageCreatedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(1)
  // No prior message, or the provider is replying to their own last message — not a response.
  if (!prior || prior.senderId === opts.providerUserId) return

  const minutes = Math.round((opts.newMessageCreatedAt.getTime() - prior.createdAt.getTime()) / 60_000)
  if (minutes < 0 || minutes > STALE_REPLY_CAP_MINUTES) return

  // Raw snake_case column names (not drizzle Column refs) — matches the proven running-counter
  // pattern already used elsewhere in this codebase (e.g. total_jobs_completed + 1 in completion.ts).
  await db
    .update(providers)
    .set({
      avgResponseTimeMinutes: sql`CASE WHEN response_time_sample_count = 0 THEN ${minutes}
        ELSE (avg_response_time_minutes * response_time_sample_count + ${minutes}) / (response_time_sample_count + 1) END`,
      responseTimeSampleCount: sql`response_time_sample_count + 1`,
    })
    .where(eq(providers.userId, opts.providerUserId))
}
