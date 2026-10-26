import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getIdentityEnabled, getIdentityMode } from "@/lib/platform/settings"
import { OnboardingIdentityClient } from "./OnboardingIdentityClient"

/**
 * The identity step of signup. Only reachable when an admin has chosen to verify cleaners at
 * onboarding; otherwise it quietly sends them on, so the URL can never strand anyone when the
 * setting is changed while they are part-way through.
 */
export default async function OnboardingIdentityPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [provider] = await db
    .select({ verificationStatus: providers.verificationStatus })
    .from(providers)
    .where(eq(providers.userId, userId))

  if (!provider) redirect("/onboarding")

  // Already done — this is once per cleaner for life, never per job.
  if (provider.verificationStatus === "verified") redirect("/provider/dashboard")

  const [enabled, mode] = await Promise.all([getIdentityEnabled(), getIdentityMode()])
  if (!enabled || mode !== "onboarding") redirect("/provider/dashboard")

  return <OnboardingIdentityClient />
}
