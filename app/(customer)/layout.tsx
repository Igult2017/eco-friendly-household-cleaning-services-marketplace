import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect("/sign-in")
  const role = user.publicMetadata?.role as string | undefined
  if (role && role !== "customer") redirect("/onboarding")

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      {children}
    </div>
  )
}
