import { db } from "@/lib/db"
import { users, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Same pattern already used by hand for a Stripe chargeback (app/api/webhooks/stripe/route.ts) —
// every admin gets one notification, visible in their existing bell, no separate alerting channel
// to check. Used for automated payment/payout failures so they can't fail silently.
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
}
