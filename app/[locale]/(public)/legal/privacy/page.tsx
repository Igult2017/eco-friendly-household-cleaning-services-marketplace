import type { Metadata } from "next"
import { LegalMarkdown } from "@/components/legal/LegalMarkdown"
import { privacyMarkdown } from "@/lib/legal/privacy"

export const metadata: Metadata = {
  title: "Privacy Policy — DORIXÉ",
  description: "How DORIXÉ collects, uses, and protects your personal data — GDPR (EU) and US state privacy rights (CCPA/CPRA and others).",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <LegalMarkdown source={privacyMarkdown} />
    </div>
  )
}
