import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth/requireAdmin"
import { db } from "@/lib/db"
import { emailCampaigns } from "@/lib/db/schema"
import { desc } from "drizzle-orm"

const audienceSchema = z.object({
  role: z.enum(["customer", "provider", "all"]).optional(),
  onlyConsented: z.boolean().optional(),
  signedUpWithinDays: z.number().int().positive().max(3650).optional(),
  signedUpMoreThanDays: z.number().int().positive().max(3650).optional(),
  hasBooked: z.boolean().optional(),
  noBookings: z.boolean().optional(),
  limit: z.number().int().positive().max(5000).optional(),
}).default({})

const createSchema = z.object({
  name: z.string().min(2).max(160),
  type: z.enum(["welcome", "value", "soft_sell", "hard_sell", "custom"]),
  subject: z.string().max(240).optional(),
  brief: z.string().max(2000).optional(),
  bodyHtml: z.string().max(50_000).optional(),
  aiGenerated: z.boolean().default(false),
  personalizePerUser: z.boolean().default(true),
  audience: audienceSchema,
})

export async function GET() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const rows = await db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt)).limit(100)
  return NextResponse.json({ campaigns: rows })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const [row] = await db
    .insert(emailCampaigns)
    .values({
      name: d.name,
      type: d.type,
      subject: d.subject,
      brief: d.brief,
      bodyHtml: d.bodyHtml,
      aiGenerated: d.aiGenerated,
      personalizePerUser: d.personalizePerUser,
      audience: d.audience,
      status: "draft",
      createdBy: guard.adminId,
    })
    .returning({ id: emailCampaigns.id })
  return NextResponse.json({ id: row.id }, { status: 201 })
}
