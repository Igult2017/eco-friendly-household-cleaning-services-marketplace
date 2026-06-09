import Link from "next/link"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Review = {
  id: string
  overallRating: number
  cleanlinessRating: number | null
  punctualityRating: number | null
  ecoComplianceRating: number | null
  communicationRating: number | null
  title: string | null
  body: string | null
  createdAt: Date | string
  customer: { firstName: string | null; lastName: string | null } | null
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={cn(i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200")}
        />
      ))}
    </span>
  )
}

function avg(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v !== null)
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null
}

const CATEGORIES = [
  { key: "cleanlinessRating",    label: "Cleanliness" },
  { key: "punctualityRating",    label: "Punctuality" },
  { key: "ecoComplianceRating",  label: "Eco compliance" },
  { key: "communicationRating",  label: "Communication" },
] as const

export function ProviderDashboardRating({
  overallRating,
  totalReviews,
  reviews,
}: {
  overallRating: number | null
  totalReviews: number
  reviews: Review[]
}) {
  const catAvgs = CATEGORIES.map((c) => ({
    label: c.label,
    value: avg(reviews.map((r) => r[c.key])),
  }))

  return (
    <div className="bg-white rounded-2xl border border-[#E5EBF0] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0F4F8] flex items-center justify-between">
        <h2 className="font-semibold text-[#2B3441] flex items-center gap-2">
          <Star size={16} className="text-amber-400 fill-amber-400" /> Your Rating
        </h2>
        <Link href="/reviews" className="text-xs text-[#2D7A5F] hover:underline">All reviews →</Link>
      </div>

      {totalReviews === 0 ? (
        <div className="px-5 py-8 text-center">
          <Star size={36} className="mx-auto text-gray-200 fill-gray-200 mb-3" />
          <p className="font-semibold text-[#2B3441] mb-1">No reviews yet</p>
          <p className="text-sm text-[#6B7280]">Your ratings from completed jobs will appear here.</p>
        </div>
      ) : (
        <>
          {/* Overall score */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-[#F0F4F8]">
            <p className="text-4xl font-bold text-[#2B3441]">
              {overallRating ? Number(overallRating).toFixed(1) : "—"}
            </p>
            <div>
              <Stars rating={overallRating ?? 0} size={18} />
              <p className="text-xs text-[#9CA3AF] mt-1">{totalReviews} review{totalReviews !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="px-5 py-3 space-y-2 border-b border-[#F0F4F8]">
            {catAvgs.map(({ label, value }) => value !== null && (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-[#6B7280] w-32 shrink-0">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full"
                    style={{ width: `${(value / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#2B3441] w-6 text-right">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* Recent reviews */}
          <div className="divide-y divide-[#F0F4F8]">
            {reviews.slice(0, 3).map((r) => {
              const name = [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(" ") || "Client"
              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#2B3441]">{name}</span>
                    <Stars rating={r.overallRating} size={12} />
                  </div>
                  {r.body && <p className="text-xs text-[#6B7280] line-clamp-2">{r.body}</p>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
