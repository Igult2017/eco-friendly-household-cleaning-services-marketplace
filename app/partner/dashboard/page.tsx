import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard"

export const dynamic = "force-dynamic"

// Authenticated home for standalone affiliates (role = "affiliate"). Middleware gates /partner to that
// role (admins pass too). Self-contained header so it doesn't depend on the customer/provider layouts.
export default function PartnerDashboardPage() {
  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E5EDE9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-xl text-[#2B3441]">DORIXÉ</Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#2D7A5F]">Affiliate</span>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-[#2B3441]">Affiliate Dashboard</h1>
          <p className="text-[#6B7280] mt-1">Track the people you've referred and what you've earned.</p>
        </div>
        <AffiliateDashboard />
      </main>
    </div>
  )
}
