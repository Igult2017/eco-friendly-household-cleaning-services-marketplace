import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe/client"
import { db } from "@/lib/db"
import { providers, providerIdentityVerifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [provider] = await db
      .select({ id: providers.id })
      .from(providers)
      .where(eq(providers.userId, userId))

    if (!provider) {
      return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })
    }

    const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!

    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: { document: { require_matching_selfie: true } },
      return_url: `${origin}/onboarding/provider?step=2&identity=complete`,
      metadata: { provider_id: provider.id },
    })

    const [existing] = await db
      .select({ id: providerIdentityVerifications.id })
      .from(providerIdentityVerifications)
      .where(eq(providerIdentityVerifications.providerId, provider.id))

    if (existing) {
      await db
        .update(providerIdentityVerifications)
        .set({ stripeVerificationSessionId: session.id, status: "pending" })
        .where(eq(providerIdentityVerifications.id, existing.id))
    } else {
      await db.insert(providerIdentityVerifications).values({
        providerId: provider.id,
        stripeVerificationSessionId: session.id,
        status: "pending",
      })
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("[stripe/identity/session POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
