import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { OnboardingRoleClient } from "./OnboardingRoleClient"

export default async function OnboardingPage() {
  const user = await currentUser()
  const role = user?.publicMetadata?.role as string | undefined

  if (role === "provider") redirect("/provider/dashboard")
  if (role === "customer") redirect("/dashboard")
  if (role === "admin") redirect("/admin/dashboard")

  return <OnboardingRoleClient />
}
