import type { Metadata } from "next"
import { LegalMarkdown } from "@/components/legal/LegalMarkdown"
import { impressumMarkdown } from "@/lib/legal/impressum"

export const metadata: Metadata = {
  title: "Impressum / Legal Notice — DORIXÉ",
  description: "DORIXÉ legal notice and provider identification (Impressum) under §5 DDG / EU and applicable law.",
}

export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <LegalMarkdown source={impressumMarkdown} />
    </div>
  )
}
