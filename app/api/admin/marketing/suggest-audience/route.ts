import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { suggestSegment } from "@/lib/ai/gemini"
import { countAudience } from "@/lib/marketing/audience"

const schema = z.object({ goal: z.string().min(3).max(500) })

// AI suggests a segment filter from a marketing goal, plus a live recipient count.
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const { filter, rationale } = await suggestSegment(parsed.data.goal)
    const count = await countAudience(filter, true)
    return NextResponse.json({ filter, rationale, count })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
