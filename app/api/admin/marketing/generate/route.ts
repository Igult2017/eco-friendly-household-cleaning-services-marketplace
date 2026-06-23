import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { generateMarketingEmail } from "@/lib/ai/gemini"

const schema = z.object({
  type: z.enum(["welcome", "value", "soft_sell", "hard_sell", "custom"]),
  brief: z.string().max(2000).optional(),
})

// AI draft for the composer's "Generate with AI" button (sample recipient — real
// sends personalize per user). Returns { subject, html }.
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const draft = await generateMarketingEmail({
      type: parsed.data.type,
      brief: parsed.data.brief,
      recipient: { firstName: "there", role: "customer", signedUpDaysAgo: 2, bookingCount: 0 },
    })
    return NextResponse.json(draft)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
