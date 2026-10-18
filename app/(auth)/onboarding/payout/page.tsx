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
  // "pending" as well as "active": the details are already submitted and Stripe is reviewing them,
  // so there is nothing left for the cleaner to type on this step.
  if (["active", "pending"].includes(provider.stripeAccountStatus ?? "")) redirect("/provider/dashboard")

  return <OnboardingPayoutClient />
}
