import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { OnboardingPayoutClient } from "./OnboardingPayoutClient"

export default async function OnboardingPayoutPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db
    .select({ stripeAccountStatus: providers.stripeAccountStatus })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/onboarding")
  if (provider.stripeAccountStatus === "active") redirect("/provider/dashboard")

  return <OnboardingPayoutClient />
}
