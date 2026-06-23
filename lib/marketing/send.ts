import { resend, FROM } from "@/lib/resend/client"
import { unsubscribeUrl } from "./unsubscribe"

// Wrap AI-generated body HTML in a branded, email-client-safe shell + GDPR footer.
export function wrapEmail(contentHtml: string, unsubUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">
      ${contentHtml}
    </div>
    <div style="text-align:center;color:#9CA3AF;font-size:12px;padding:18px 8px;line-height:1.6;">
      You're receiving this because you have a DORIXÉ account.<br/>
      <a href="${unsubUrl}" style="color:#6B7280;text-decoration:underline;">Unsubscribe</a> from marketing emails · DORIXÉ, European Union
    </div>
  </div></body></html>`
}

// Send a marketing email to one recipient. Returns the Resend message ID.
export async function sendMarketingEmail(params: {
  to: string
  subject: string
  contentHtml: string
  userId: string
}): Promise<string> {
  const unsubUrl = unsubscribeUrl(params.userId)
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: wrapEmail(params.contentHtml, unsubUrl),
    headers: {
      // One-click unsubscribe (RFC 8058) — major deliverability + spam-compliance win.
      "List-Unsubscribe": `<${unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
  return data!.id
}
