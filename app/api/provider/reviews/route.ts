import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reviews, providers, users } from "@/lib/db/schema"
import { eq, desc } from "drizzle-orm"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 })

  const rows = await db
    .select({
      id: reviews.id,
      overallRating: reviews.overallRating,
      title: reviews.title,
      body: reviews.body,
      providerResponse: reviews.providerResponse,
      providerRespondedAt: reviews.providerRespondedAt,
      createdAt: reviews.createdAt,
      customerFirstName: users.firstName,
    })
    .from(reviews)
    .leftJoin(users, eq(reviews.customerId, users.id))
    .where(eq(reviews.providerId, provider.id))
    .orderBy(desc(reviews.createdAt))
    .limit(50)

  return NextResponse.json({ reviews: rows })
}
