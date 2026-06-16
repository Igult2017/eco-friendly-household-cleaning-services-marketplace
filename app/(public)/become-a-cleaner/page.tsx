import { auth } from "@clerk/nextjs/server"
import { getTranslations } from "next-intl/server"
import { Leaf, Euro, Clock, ShieldCheck, Star, Users } from "lucide-react"
import { AddCleanerRoleForm } from "@/components/layout/AddCleanerRoleForm"
import { EnableCustomerRoleButton } from "@/components/layout/EnableCustomerRoleButton"
import Link from "next/link"

export const metadata = {
  title: "Become a Cleaner — DORIXÉ",
  description: "Join DORIXÉ as an eco-certified cleaner. Set your own rates, work your own schedule, get paid weekly.",
}

export default async function BecomeACleanerPage() {
  const t = await getTranslations("becomeCleaner")
  const PERKS = [
    { icon: Euro,        title: t("perkRateTitle"),       body: t("perkRateBody") },
    { icon: Clock,       title: t("perkScheduleTitle"),   body: t("perkScheduleBody") },
    { icon: ShieldCheck, title: t("perkPayoutTitle"),     body: t("perkPayoutBody") },
    { icon: Star,        title: t("perkReputationTitle"), body: t("perkReputationBody") },
    { icon: Leaf,        title: t("perkEcoTitle"),        body: t("perkEcoBody") },
    { icon: Users,       title: t("perkDualTitle"),       body: t("perkDualBody") },
  ]
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
            <Leaf size={11} /> {t("heroBadge")}
          </span>
          <h1 className="font-serif text-5xl font-bold leading-tight">
            <span className="text-white">{t("heroTitleLine1")}<br />{t("heroTitleLine2")}</span>
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            {t("heroSubtitle")}
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
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("noRoleTitle")}</h2>
            <p className="text-[#6B7280] text-sm">{t("noRoleBody")}</p>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-sm transition-colors"
            >
              {t("noRoleCta")}
            </Link>
            <p className="text-xs text-[#6B7280]">
              {t("noRoleHaveAccount")}{" "}
              <Link href="/sign-in" className="text-[#2D7A5F] underline">{t("noRoleSignIn")}</Link>
            </p>
          </div>
        )}

        {role && isDual && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#EDF5F0] flex items-center justify-center mx-auto">
              <Leaf size={24} className="text-[#2D7A5F]" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("dualTitle")}</h2>
            <p className="text-[#6B7280] text-sm">{t("dualBody")}</p>
            <Link
              href="/provider/dashboard"
              className="inline-flex items-center justify-center h-12 px-8 rounded-xl bg-[#2D7A5F] hover:bg-[#235f49] text-white font-semibold text-sm transition-colors"
            >
              {t("dualCta")}
            </Link>
          </div>
        )}

        {role && !isDual && isProvider && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-8 text-center space-y-4">
            <h2 className="font-serif text-2xl font-bold text-[#2B3441]">{t("providerTitle")}</h2>
            <p className="text-[#6B7280] text-sm">{t("providerBody")}</p>
            <EnableCustomerRoleButton />
          </div>
        )}

        {role && !isDual && !isProvider && (
          <div className="bg-white rounded-2xl border border-[#E5EBF0] shadow-sm p-6">
            <h2 className="font-serif text-2xl font-bold text-[#2B3441] mb-1">{t("addAccountTitle")}</h2>
            <p className="text-[#6B7280] text-sm mb-6">
              {t("addAccountBody")}
            </p>
            <AddCleanerRoleForm />
          </div>
        )}
      </section>
    </div>
  )
}
