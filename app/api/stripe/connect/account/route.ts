import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { providers, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createConnectAccount, createAccountLink } from "@/lib/stripe/connect"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [[provider], [user]] = await Promise.all([
    db.select({ id: providers.id, stripeAccountId: providers.stripeAccountId })
      .from(providers).where(eq(providers.userId, userId)),
    db.select({ email: users.email }).from(users).where(eq(users.id, userId)),
  ])

  if (!provider) {
    return NextResponse.json({ error: "Provider profile not found" }, { status: 404 })
  }

  let stripeAccountId = provider.stripeAccountId

  if (!stripeAccountId) {
    const body = await req.json().catch(() => ({}))
    const account = await createConnectAccount({
      email: user?.email ?? undefined,
      country: body.country ?? "DE",
    })
    stripeAccountId = account.id

    await db
      .update(providers)
      .set({ stripeAccountId, stripeAccountStatus: "pending" })
      .where(eq(providers.id, provider.id))
  }

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!
  const link = await createAccountLink({
    accountId: stripeAccountId,
    refreshUrl: `${origin}/onboarding/provider?step=4&refresh=1`,
    returnUrl: `${origin}/onboarding/provider?step=4&success=1`,
  })

  return NextResponse.json({ url: link.url })
}
