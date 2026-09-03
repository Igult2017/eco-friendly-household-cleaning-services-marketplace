import { inngest } from "../client"
import { db } from "@/lib/db"
import { blogPosts } from "@/lib/db/schema"
import { and, eq, lte, isNotNull, sql } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

/**
 * Publishes scheduled blog posts once their moment arrives.
 *
 * Runs every 5 minutes rather than hourly so a post lands close to the time the admin picked;
 * choosing 09:00 and going live at 09:47 looks broken.
 *
 * published_at is stamped with the post's OWN scheduled time, not the moment this happened to run.
 * The public blog orders by published_at, so using the run time would shuffle posts scheduled close
 * together into whatever order the sweep noticed them.
 */
export const blogScheduleSweep = inngest.createFunction(
  { id: "blog-schedule-sweep", retries: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }: { step: any }) => {
    type Published = { id: string; slug: string; title: string }
    const published: Published[] = await step.run("publish-due", async () => {
      // One statement does the whole job: only rows still 'scheduled' and already due are touched,
      // so two overlapping runs cannot publish the same post twice — the second finds nothing.
      const rows = await db
        .update(blogPosts)
        .set({
          status: "published",
          publishedAt: sql`${blogPosts.scheduledFor}`,
          scheduledFor: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(blogPosts.status, "scheduled"),
            isNotNull(blogPosts.scheduledFor),
            lte(blogPosts.scheduledFor, new Date()),
          ),
        )
        .returning({ id: blogPosts.id, slug: blogPosts.slug, title: blogPosts.title })
      return rows
    })

    if (published.length > 0) {
      // Worth a log line: a post going live is the kind of thing you want to be able to trace back
      // when someone asks "when did that appear?".
      console.log(`[blog-schedule] published ${published.length}:`, published.map((p: Published) => p.slug).join(", "))

      await step.run("warn-if-stale", async () => {
        // A post that went live long after its slot means the sweep stopped running for a while —
        // silence there would look identical to "nothing was scheduled".
        try {
          const [stuck] = await db
            .select({ n: sql<number>`cast(count(*) as int)` })
            .from(blogPosts)
            .where(and(eq(blogPosts.status, "scheduled"), lte(blogPosts.scheduledFor, new Date(Date.now() - 3_600_000))))
          if (Number(stuck?.n ?? 0) > 0) {
            await logError({
              message: `${stuck.n} scheduled blog post(s) are more than an hour overdue`,
              route: "inngest/blog-schedule-sweep",
              severity: "warning",
            })
          }
        } catch { /* the warning must never break the publish itself */ }
      })
    }

    return { published: published.length, slugs: published.map((p: Published) => p.slug) }
  },
)
