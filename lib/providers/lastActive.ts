import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq, and, or, isNull, lt, sql } from "drizzle-orm"

const THROTTLE_MINUTES = 10

// Fire-and-forget, throttled: most calls touch zero rows (the WHERE clause filters before any write
// happens), so this stays cheap even called on every /provider/* page load — no cron needed to keep
// "last active" current. Self-hosted Node deploy (not serverless), so a dangling promise after the
// response is sent still runs to completion.
export async function stampProviderLastActive(userId: string) {
  const staleBefore = new Date(Date.now() - THROTTLE_MINUTES * 60_000)
  await db
    .update(providers)
    .set({ lastActiveAt: sql`now()` })
    .where(
      and(
        eq(providers.userId, userId),
        or(isNull(providers.lastActiveAt), lt(providers.lastActiveAt, staleBefore))
      )
    )
}
