import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reviews, providers } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { z } from "zod"

const respondSchema = z.object({
  response: z.string().min(10).max(1000),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: reviewId } = await params

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Not a provider" }, { status: 403 })

    const [review] = await db.select({ id: reviews.id, providerId: reviews.providerId }).from(reviews).where(eq(reviews.id, reviewId))
    if (!review || review.providerId !== provider.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 })

    const body = await req.json()
    const parsed = respondSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    await db.update(reviews).set({
      providerResponse: parsed.data.response,
      providerRespondedAt: new Date(),
    }).where(eq(reviews.id, reviewId))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[reviews/[id]/respond POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
