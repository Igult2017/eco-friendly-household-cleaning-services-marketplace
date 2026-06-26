import { resend, FROM } from "@/lib/resend/client"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.xn--dorix-fsa.com"

/**
 * Congratulations email sent whenever a cleaner is approved — automatically on profile completion
 * or by an admin. Transactional (no marketing unsubscribe). Looks up the recipient by user id.
 * Throws on send failure; callers wrap in try/catch so a mail issue never blocks the approval.
 */
export async function sendProviderApprovedEmail(userId: string): Promise<void> {
  const [u] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId))

  // Skip placeholder/parked rows (migrated accounts use a *.dorixe.invalid email).
  if (!u?.email || u.email.includes("@dorixe.invalid")) return

  const name = u.firstName?.trim() || "there"
  const html = `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;">You're approved! 🎉</h1>
      <p style="margin:0 0 12px;">Hi ${name},</p>
      <p style="margin:0 0 16px;">Congratulations — your DORIXÉ <strong>cleaner account</strong> has been approved. You can now browse open jobs, place bids, and start earning.</p>
      <a href="${APP_URL}/provider/dashboard" style="display:inline-block;background:#2D7A5F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;">Go to your dashboard</a>
      <p style="margin:18px 0 0;color:#6B7280;font-size:13px;">Welcome to the DORIXÉ community — clean home, green future.</p>
    </div>
  </div></body></html>`

  const { error } = await resend.emails.send({
    from: FROM,
    to: u.email,
    subject: "🎉 You're approved — welcome to DORIXÉ!",
    html,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}
