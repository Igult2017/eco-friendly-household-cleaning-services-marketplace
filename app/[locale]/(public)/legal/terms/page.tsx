import type { Metadata } from "next"
import { LegalMarkdown } from "@/components/legal/LegalMarkdown"
import { termsMarkdown } from "@/lib/legal/terms"

export const metadata: Metadata = {
  title: "Terms of Service — DORIXÉ",
  description: "DORIXÉ Terms of Service — marketplace rules, payments, cancellations, and your rights across the EU, US, and globally.",
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <LegalMarkdown source={termsMarkdown} />
    </div>
  )
}
