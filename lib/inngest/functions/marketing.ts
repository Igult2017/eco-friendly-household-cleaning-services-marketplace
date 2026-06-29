import { inngest } from "../client"
import { db } from "@/lib/db"
import { emailCampaigns, emailSends, users } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { generateMarketingEmail } from "@/lib/ai/gemini"
import { sendMarketingEmail } from "@/lib/marketing/send"
import { resolveAudience } from "@/lib/marketing/audience"
import type { AudienceFilter, CampaignType, EmailDraft } from "@/lib/marketing/types"

import { welcomeEmail } from "@/lib/resend/emailContent"

// Welcome email — fired on signup. Transactional (sent to every new user), deduped per user.
export const onUserWelcome = inngest.createFunction(
  { id: "user-welcome-email", retries: 2, triggers: [{ event: "user/welcome" }] },
  async ({ event, step }: { event: { data: { userId: string } }; step: any }) => {
    const { userId } = event.data
    const [u] = await db.select({ email: users.email, firstName: users.firstName, role: users.role, createdAt: users.createdAt, locale: users.locale }).from(users).where(eq(users.id, userId))
    if (!u?.email) return { skipped: "no_user" }

    const [already] = await db.select({ id: emailSends.id }).from(emailSends).where(and(eq(emailSends.userId, userId), eq(emailSends.type, "welcome"))).limit(1)
    if (already) return { skipped: "already_welcomed" }

    const draft: EmailDraft = await step.run("generate", async () => {
      try {
        return await generateMarketingEmail({ type: "welcome", locale: u.locale ?? undefined, recipient: { firstName: u.firstName, role: u.role, signedUpDaysAgo: 0, bookingCount: 0 } })
      } catch {
        return welcomeEmail(u.locale, u.firstName)
      }
    })

    const res = await step.run("send", async () => {
      try {
        // Idempotency key → Resend dedupes if this step retries after a partial failure.
        const id = await sendMarketingEmail({ to: u.email, subject: draft.subject, contentHtml: draft.html, userId, idempotencyKey: `welcome-${userId}` })
        return { ok: true, id }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    })

    await step.run("record", async () => {
      // Partial unique index (type='welcome') makes this the DB-level dedupe.
      await db.insert(emailSends).values({
        userId, email: u.email, type: "welcome",
        status: res.ok ? "sent" : "failed", subject: draft.subject,
        resendMessageId: res.ok ? res.id : null, error: res.ok ? null : res.error,
        sentAt: res.ok ? new Date() : null,
      }).onConflictDoNothing()
    })
    return { sent: res.ok }
  }
)

// Campaign fan-out — admin-triggered. Per-recipient AI copy (anti-spam) + send + log.
// One step loops the whole audience; the email_sends unique index makes retries idempotent.
export const sendCampaign = inngest.createFunction(
  { id: "marketing-send-campaign", retries: 1, triggers: [{ event: "marketing/campaign.send" }] },
  async ({ event, step }: { event: { data: { campaignId: string } }; step: any }) => {
    const { campaignId } = event.data
    const [c] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId))
    if (!c || c.status === "completed") return { skipped: true }

    // A non-personalized campaign with no body would send blank emails — refuse it.
    if (!c.personalizePerUser && !(c.bodyHtml ?? "").trim()) {
      await db.update(emailCampaigns).set({ status: "failed", updatedAt: new Date() }).where(eq(emailCampaigns.id, campaignId))
      return { skipped: "empty_body" }
    }

    await db.update(emailCampaigns).set({ status: "sending", updatedAt: new Date() }).where(eq(emailCampaigns.id, campaignId))
    const audience = await resolveAudience((c.audience as AudienceFilter) ?? {}, true)

    await step.run("send-all", async () => {
      for (const user of audience) {
        const [ex] = await db.select({ id: emailSends.id }).from(emailSends).where(and(eq(emailSends.campaignId, campaignId), eq(emailSends.userId, user.id))).limit(1)
        if (ex) continue
        let subject = c.subject ?? "A note from DORIXÉ"
        let html = c.bodyHtml ?? ""
        if (c.personalizePerUser) {
          try {
            const d = await generateMarketingEmail({ type: c.type as CampaignType, brief: c.brief ?? undefined, recipient: user })
            subject = d.subject; html = d.html
          } catch { /* fall back to base subject/body */ }
        }
        if (!html.trim()) {
          // Never send a blank email (Gemini failed + no base body) — record as skipped.
          await db.insert(emailSends).values({ campaignId, userId: user.id, email: user.email, type: c.type, status: "skipped", subject, error: "empty body" }).onConflictDoNothing()
          continue
        }
        let ok = false, mid: string | null = null, err: string | null = null
        try { mid = await sendMarketingEmail({ to: user.email, subject, contentHtml: html, userId: user.id, idempotencyKey: `camp-${campaignId}-${user.id}` }); ok = true } catch (e) { err = (e as Error).message }
        await db.insert(emailSends).values({
          campaignId, userId: user.id, email: user.email, type: c.type,
          status: ok ? "sent" : "failed", subject, resendMessageId: mid, error: err, sentAt: ok ? new Date() : null,
        }).onConflictDoNothing()
      }
    })

    // Counts from the DB → accurate even if the step retried mid-loop. Status reflects reality.
    const [counts] = await db
      .select({
        sent: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'sent') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${emailSends.status} = 'failed') as int)`,
      })
      .from(emailSends)
      .where(eq(emailSends.campaignId, campaignId))
    const sent = counts?.sent ?? 0
    const failed = counts?.failed ?? 0
    await db.update(emailCampaigns).set({
      status: sent > 0 ? "completed" : "failed", sentCount: sent, failedCount: failed,
      totalRecipients: audience.length, sentAt: new Date(), updatedAt: new Date(),
    }).where(eq(emailCampaigns.id, campaignId))
    return { sent, failed, total: audience.length }
  }
)
