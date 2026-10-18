import { db } from "@/lib/db"
import { users, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { shell, esc, H1S, PS, BTNS } from "@/lib/resend/emailShell"
import { SITE_URL } from "@/lib/seo/site"

// Every admin gets one notification in their existing bell, so automated payment/payout failures
// can't fail silently. Used by 6 call sites: the lapsed-hold recharge failure (completion.ts),
// referral clawbacks (clawback.ts), cancellation problems (cancellationNotices.ts) and two Stripe
// webhook failures (webhooks/stripe/route.ts).
//
// It now ALSO EMAILS. The bell alone meant these only arrived if an admin happened to open the
// panel — a payment that could not be collected would sit unseen for days. Emailing from this one
// function upgrades all six call sites at once, rather than leaving five of them to be remembered
// later.
export async function alertAdmins(title: string, body: string, link?: string) {
  try {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))
    if (admins.length === 0) return
    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        type: "payment_automation_failed" as const,
        title,
        body,
        link,
      })),
    )
  } catch (err) {
    console.error("[notifications/adminAlert] failed to notify admins:", err)
  }

  // Separate try/catch on purpose: a mail outage must never undo or mask the in-app notification
  // above, which is the durable record. Email is the nudge, not the source of truth.
  try {
    const to = process.env.ADMIN_EMAIL
    if (!to) {
      console.warn("[notifications/adminAlert] ADMIN_EMAIL not set — admin alert email skipped")
      return
    }
    const href = link ? (link.startsWith("http") ? link : `${SITE_URL}${link}`) : `${SITE_URL}/admin`
    await resend.emails.send({
      from: FROM,
      to,
      // Prefixed so these stand out in an inbox and can be filtered into one place.
      subject: `[DORIXÉ admin] ${title}`,
      html: shell(
        `<h1 style="${H1S}">${esc(title)}</h1>` +
          `<p style="${PS}">${esc(body)}</p>` +
          `<p style="${PS}"><a href="${esc(href)}" style="${BTNS}">Open the admin panel</a></p>`,
      ),
    })
  } catch (err) {
    console.error("[notifications/adminAlert] failed to email admin:", err)
  }
}
