import { auth } from "@clerk/nextjs/server"
import { Leaf, Euro, Clock, ShieldCheck, Star, Users } from "lucide-react"
import { AddCleanerRoleForm } from "@/components/layout/AddCleanerRoleForm"
import { EnableCustomerRoleButton } from "@/components/layout/EnableCustomerRoleButton"
import Link from "next/link"

export const metadata = {
  title: "Become a Cleaner — DORIXÉ",
  description: "Join DORIXÉ as an eco-certified cleaner. Set your own rates, work your own schedule, get paid weekly.",
}

const PERKS = [
  { icon: Euro,        title: "Keep 100% of your rate",  body: "DORIXÉ charges customers a 15% platform fee on top — your quoted price is yours, always." },
  { icon: Clock,       title: "Work when you want",       body: "Set your own availability, service area, and take only the bookings you want." },
  { icon: ShieldCheck, title: "Weekly payouts",           body: "Earnings are transferred to your bank every Monday via Stripe." },
  { icon: Star,        title: "Build your reputation",    body: "Every completed booking adds a verified review to your public profile." },
  { icon: Leaf,        title: "Join an eco community",    body: "All DORIXÉ cleaners use certified non-toxic products. We verify it." },
  { icon: Users,       title: "Dual-account support",     body: "Already a customer? Switch roles in one click — your Provider Account stays separate." },
]

export default async function BecomeACleanerPage() {
  const { sessionClaims } = await auth()
  const meta     = sessionClaims?.metadata as { role?: string; dualRole?: boolean } | undefined
  const role     = meta?.role
  const isDual   = meta?.dualRole === true
  const isProvider = role === "provider"

  return (
    <div className="min-h-screen bg-[#F4FAF6]">
      <section className="bg-[#2B3441] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2D7A5F]/30 border border-[#2D7A5F]/40 px-4 py-1 text-xs font-semibold text-[#4CB87A] uppercase tracking-wide">
            <Leaf size={11} /> Eco-Certified Cleaners
          </span>
          <h1 className="font-serif text-5xl font-bold leading-tight">
            Turn your skills into<br />a green income
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Join DORIXÉ&apos;s network of vetted eco-friendly cleaners. Set your own rates, choose your jobs, and get paid weekly.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PERKS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-[#EDF5F0] flex items-center justify-center">
              <Icon size={16} className="text-[#2D7A5F]" />
            </div>
            <h3 className="font-semibold text-[#2B3441] text-sm">{title}</h3>
            <p className="text-[#6B7280] text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      <section className="max-w-lg mx-auto px-4 pb-24">
        {!role && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 text-center space-y-4">
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">Ready to get started?</h2>
            <p className="text-[#6B7280] text-sm">Create your DORIXÉ account to join as a cleaner.</p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-sm transition-colors"
            >
              Create Cleaner Account
            </Link>
            <p className="text-xs text-[#6B7280]">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-[#2D7A5F] underline">Sign in</Link>
            </p>
          </div>
        )}

        {role && isDual && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#EDF5F0] flex items-center justify-center mx-auto">
              <Leaf size={24} className="text-[#2D7A5F]" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">You already have both accounts</h2>
            <p className="text-[#6B7280] text-sm">Switch between Cleaner and Provider Account from the top navigation.</p>
            <Link
              href="/provider/dashboard"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-sm transition-colors"
            >
              Go to Cleaner Dashboard
            </Link>
          </div>
        )}

        {role && !isDual && isProvider && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 text-center space-y-4">
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">You&apos;re already a cleaner</h2>
            <p className="text-[#6B7280] text-sm">Want to also post jobs and hire other cleaners? Enable your Provider Account with one click.</p>
            <EnableCustomerRoleButton />
          </div>
        )}

        {role && !isDual && !isProvider && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6">
            <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-1">Add your Cleaner Account</h2>
            <p className="text-[#6B7280] text-sm mb-6">
              Your existing account stays intact. Switch roles any time from the navbar.
            </p>
            <AddCleanerRoleForm />
          </div>
        )}
      </section>
    </div>
  )
}
