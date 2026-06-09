import { Resend } from "resend"

export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder_build_only")

export const FROM = `${process.env.RESEND_FROM_NAME ?? "DORIX"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@dorix.eu"}>`

/** Send a transactional email. Returns the message ID. */
export async function sendEmail(params: {
  to: string | string[]
  subject: string
  react: React.ReactElement
  replyTo?: string
}): Promise<string> {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    react: params.react,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
  return data!.id
}
