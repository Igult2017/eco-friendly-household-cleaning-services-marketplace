import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { CookieBanner } from "@/components/gdpr/CookieBanner"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("authOnboardingLayout")
  return (
    <NextIntlClientProvider>
    <div className="min-h-screen bg-[#F4FAF6] flex flex-col">
      <header className="relative flex items-center justify-center py-6 border-b border-[#E5EDE9] bg-white px-4">
        <Link href="/" className="absolute left-4 flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#2D7A5F] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t("back")}
        </Link>
        <Link href="/">
          <Image src="/logo.png" alt="DORIXÉ" width={110} height={29} priority />
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
    <CookieBanner />
    </NextIntlClientProvider>
  )
}
