import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, ecoCertifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const certSchema = z.object({
  name: z.string().min(2).max(200),
  issuingBody: z.string().max(200).optional(),
  certificationNumber: z.string().max(100).optional(),
  documentUrl: z.string().url(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const certs = await db.select().from(ecoCertifications).where(eq(ecoCertifications.providerId, provider.id))
    return NextResponse.json({ certifications: certs })
  } catch (err) {
    console.error("[provider/certifications GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

    const body = await req.json()
    const parsed = certSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    // Document must be hosted in our R2 bucket — reject external URLs
    const R2_BASE = process.env.R2_PUBLIC_URL ?? ""
    if (R2_BASE && !parsed.data.documentUrl.startsWith(R2_BASE)) {
      return NextResponse.json({ error: "Document must be uploaded via DORIXÉ storage" }, { status: 400 })
    }

    const [cert] = await db.insert(ecoCertifications).values({
      providerId: provider.id,
      name: parsed.data.name,
      issuingBody: parsed.data.issuingBody ?? null,
      certificationNumber: parsed.data.certificationNumber ?? null,
      documentUrl: parsed.data.documentUrl,
      expiresAt: parsed.data.expiresAt ?? null,
    }).returning({ id: ecoCertifications.id })

    return NextResponse.json({ certificationId: cert.id }, { status: 201 })
  } catch (err) {
    console.error("[provider/certifications POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
