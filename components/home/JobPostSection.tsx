import Link from "next/link"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"

const SAMPLE_BIDS = [
  {
    initials: "A",
    provider: "Amara G.",
    rating: 4.9,
    amount: 65,
    message: "Available this Saturday with certified organic products. I bring all supplies!",
    eco: true,
  },
  {
    initials: "L",
    provider: "Lucas M.",
    rating: 4.8,
    amount: 58,
    message: "Friday morning available. 3 years deep-clean experience, zero-waste approach.",
    eco: true,
  },
  {
    initials: "S",
    provider: "Sofia P.",
    rating: 5.0,
    amount: 72,
    message: "Specialised in end-of-tenancy. Bringing all eco supplies, GDPR-compliant photos.",
    eco: true,
  },
]

export function JobPostSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#D1F0E0] text-[#2D7A5F] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              NEW · Bidding marketplace
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-4">
              Need something specific?<br />
              <span className="text-[#2D7A5F]">Post a job, get bids.</span>
            </h2>
            <p className="text-[#6B7280] mb-6 leading-relaxed text-sm">
              Describe your cleaning task, set your budget, and let verified eco-cleaners
              compete to win your booking — like Upwork, but for spotless homes.
            </p>
            <ul className="space-y-2.5 mb-8">
              {[
                "Post your job for free",
                "Receive bids within hours",
                "Compare by eco-score, rating & price",
                "Pay securely only when happy",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[#2B3441]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D7A5F] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/post-job">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
                Post a job →
              </Button>
            </Link>
          </div>

          {/* Right — sample bids */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
              Live bids on a deep-clean job · Amsterdam
            </p>
            <div className="space-y-3">
              {SAMPLE_BIDS.map((bid, i) => (
                <div
                  key={i}
                  className="bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-[#2D7A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {bid.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-[#2B3441] truncate">{bid.provider}</span>
                        {bid.eco && (
                          <span className="text-[10px] bg-[#D1F0E0] text-[#2D7A5F] px-2 py-0.5 rounded-full flex-shrink-0">
                            🌿 Eco
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-[#2B3441] text-sm flex-shrink-0">€{bid.amount}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs text-[#6B7280]">{bid.rating}</span>
                    </div>
                    <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-1">{bid.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
