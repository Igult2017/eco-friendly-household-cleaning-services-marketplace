import type { Metadata } from "next"
import { LegalMarkdown } from "@/components/legal/LegalMarkdown"
import { cookieMarkdown } from "@/lib/legal/cookie"

export const metadata: Metadata = {
  title: "Cookie Policy — DORIXÉ",
  description: "What cookies and similar technologies DORIXÉ uses, why, and how to control them under EU ePrivacy and US privacy law.",
}

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <LegalMarkdown source={cookieMarkdown} />
    </div>
  )
}
