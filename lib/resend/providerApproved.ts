import { resend, FROM } from "@/lib/resend/client"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { approvalEmail } from "./emailContent"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.xn--dorix-fsa.com"

/**
 * Congratulations email sent whenever a cleaner is approved — automatically on profile completion
 * or by an admin. Transactional (no marketing unsubscribe). Localized to the user's stored locale
 * (detected from IP country at onboarding). Throws on send failure; callers wrap in try/catch so a
 * mail issue never blocks the approval.
 */
export async function sendProviderApprovedEmail(userId: string): Promise<void> {
  const [u] = await db
    .select({ email: users.email, firstName: users.firstName, locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))

  // Skip placeholder/parked rows (migrated accounts use a *.dorixe.invalid email).
  if (!u?.email || u.email.includes("@dorixe.invalid")) return

  const { subject, html } = approvalEmail(u.locale, u.firstName, `${APP_URL}/provider/dashboard`)

  const { error } = await resend.emails.send({ from: FROM, to: u.email, subject, html })
  if (error) throw new Error(`Resend error: ${error.message}`)
}
