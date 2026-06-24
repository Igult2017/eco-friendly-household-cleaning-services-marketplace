import Link from "next/link"
import { XCircle } from "lucide-react"
import { UnsubscribeConfirm } from "@/components/marketing/UnsubscribeConfirm"

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; ok?: string }> }) {
  const { token } = await searchParams

  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-8">
        {token ? (
          <UnsubscribeConfirm token={token} />
        ) : (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">Invalid unsubscribe link</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              This link is missing its token. Please use the unsubscribe link from your most recent DORIXÉ
              email, or manage email preferences in your account settings.
            </p>
            <Link href="/" className="inline-block mt-6 text-sm font-semibold text-[#2D7A5F] hover:underline">← Back to DORIXÉ</Link>
          </>
        )}
      </div>
    </div>
  )
}
