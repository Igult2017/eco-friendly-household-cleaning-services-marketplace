import Link from "next/link"
import { CheckCircle2, XCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams
  const success = ok === "1"

  return (
    <div className="max-w-md mx-auto py-20 px-4 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5EBF0] p-8">
        {success ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-[#2D7A5F] mx-auto mb-4" />
            <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">You&apos;re unsubscribed</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              You won&apos;t receive marketing emails from DORIXÉ anymore. You&apos;ll still get essential
              account and booking notifications. Changed your mind? You can re-enable marketing emails in
              your account settings anytime.
            </p>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="font-serif text-2xl font-bold text-[#2B3441] mb-2">Link expired or invalid</h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              We couldn&apos;t process this unsubscribe link. Please use the link from your most recent
              email, or manage email preferences in your account settings.
            </p>
          </>
        )}
        <Link href="/" className="inline-block mt-6 text-sm font-semibold text-[#2D7A5F] hover:underline">
          ← Back to DORIXÉ
        </Link>
      </div>
    </div>
  )
}
