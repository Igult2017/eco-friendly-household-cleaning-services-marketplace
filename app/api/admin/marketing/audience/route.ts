import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { countAudience } from "@/lib/marketing/audience"
import type { AudienceFilter } from "@/lib/marketing/types"

const filterSchema = z.object({
  role: z.enum(["customer", "provider", "all"]).optional(),
  onlyConsented: z.boolean().optional(),
  signedUpWithinDays: z.number().int().positive().max(3650).optional(),
  signedUpMoreThanDays: z.number().int().positive().max(3650).optional(),
  hasBooked: z.boolean().optional(),
  noBookings: z.boolean().optional(),
  limit: z.number().int().positive().max(5000).optional(),
})

const schema = z.object({ filter: filterSchema.default({}), forMarketing: z.boolean().default(true) })

// Live recipient count for the admin "Preview audience" button.
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const count = await countAudience(parsed.data.filter as AudienceFilter, parsed.data.forMarketing)
    return NextResponse.json({ count })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
