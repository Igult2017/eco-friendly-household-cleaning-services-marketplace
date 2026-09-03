import { inngest } from "../client"
import { db } from "@/lib/db"
import { emailCampaigns } from "@/lib/db/schema"
import { and, eq, lte, isNotNull } from "drizzle-orm"
import { logError } from "@/lib/utils/logError"

/**
 * Sends campaigns that were scheduled for a future date, once that date arrives.
 *
 * email_campaigns has always had a scheduled_at column and a "scheduled" status, but nothing ever
 * read them — a campaign set to go out later just sat there forever, looking like a working feature.
 * This is what makes "send later" real.
 *
 * Runs every 5 minutes rather than hourly so a campaign lands near the minute an admin picked;
 * scheduling an email for 09:00 and having it leave at 09:47 looks broken.
 *
 * Kept in its own file rather than added to marketing.ts, which is already at ~170 lines.
 */
export const marketingScheduleSweep = inngest.createFunction(
  { id: "marketing-schedule-sweep", retries: 1, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }: { step: any }) => {
    const due = await step.run("find-due", async () =>
      db
        .select({ id: emailCampaigns.id, name: emailCampaigns.name })
        .from(emailCampaigns)
        .where(
          and(
            eq(emailCampaigns.status, "scheduled"),
            isNotNull(emailCampaigns.scheduledAt),
            lte(emailCampaigns.scheduledAt, new Date()),
          ),
        )
        .limit(25),
    )

    if (due.length === 0) return { due: 0 }

    let fired = 0
    for (const campaign of due) {
      try {
        // Clear the due date as we hand off, so a slow send can't be picked up twice by the next
        // sweep. The send function itself also refuses a campaign already sending or completed.
        await db
          .update(emailCampaigns)
          .set({ scheduledAt: null, updatedAt: new Date() })
          .where(and(eq(emailCampaigns.id, campaign.id), eq(emailCampaigns.status, "scheduled")))

        await inngest.send({ name: "marketing/campaign.send", data: { campaignId: campaign.id } })
        fired++
      } catch (e) {
        await logError({
          message: `Scheduled campaign "${campaign.name}" could not be queued`,
          error: e,
          route: "inngest/marketing-schedule-sweep",
          context: { campaignId: campaign.id },
        })
      }
    }

    return { due: due.length, fired }
  },
)
