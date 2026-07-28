import { resend, FROM } from "@/lib/resend/client"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { referralExplainerEmail } from "./emailContent"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.xn--dorix-fsa.com"

/**
 * Referral-programme explainer email, sent once right after the welcome email (both roles).
 * Transactional (no marketing unsubscribe). Throws on send failure; callers wrap in try/catch so a
 * mail issue never blocks onboarding.
 */
export async function sendReferralExplainerEmail(userId: string): Promise<void> {
  const [u] = await db
    .select({ email: users.email, firstName: users.firstName, locale: users.locale, role: users.role })
    .from(users)
    .where(eq(users.id, userId))

  if (!u?.email || u.email.includes("@dorixe.invalid")) return

  const isCleanerRole = u.role === "provider"
  const dashboardUrl = `${APP_URL}${isCleanerRole ? "/provider/dashboard" : "/dashboard"}`
  const { subject, html } = referralExplainerEmail(u.locale, u.firstName, isCleanerRole, dashboardUrl)

  const { error } = await resend.emails.send({ from: FROM, to: u.email, subject, html })
  if (error) throw new Error(`Resend error: ${error.message}`)
}
