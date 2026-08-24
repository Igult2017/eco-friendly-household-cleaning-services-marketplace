import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { OnboardingPaymentClient } from "./OnboardingPaymentClient"

export default async function OnboardingPaymentPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
  if (!user) redirect("/onboarding")
  if (user.role !== "customer") redirect("/dashboard")

  // Whether a card already exists is checked client-side (SaveCardPrompt already does this, and
  // reusing that check here would just duplicate the same Stripe call) — this page only gates role.
  return <OnboardingPaymentClient />
}
