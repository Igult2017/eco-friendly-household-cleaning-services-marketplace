import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getIdentityEnabled, getIdentityMode } from "@/lib/platform/settings"
import { OnboardingPayoutClient } from "./OnboardingPayoutClient"

export default async function OnboardingPayoutPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db
    .select({ stripeAccountStatus: providers.stripeAccountStatus })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/onboarding")

  // Where this step hands on to. The identity step only exists when an admin has chosen to verify
  // cleaners at signup; otherwise signup ends here, exactly as before.
  const [enabled, mode] = await Promise.all([getIdentityEnabled(), getIdentityMode()])
  const nextStep = enabled && mode === "onboarding" ? "/onboarding/identity" : "/provider/dashboard"

  // "pending" as well as "active": the details are already submitted and Stripe is reviewing them,
  // so there is nothing left for the cleaner to type on this step.
  if (["active", "pending"].includes(provider.stripeAccountStatus ?? "")) redirect(nextStep)

  return <OnboardingPayoutClient nextStep={nextStep} />
}
