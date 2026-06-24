import Link from "next/link"
import { Star } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Button } from "@/components/ui/button"

type FeedItem =
  | { kind: "bid"; initials: string; provider: string; rating: number; amount: number; messageKey?: string; message?: string; eco: boolean }
  | { kind: "job"; city: string; title: string; budget: string }

// Live-feed sample (bids + job posts) that scrolls within a fixed viewport.
const FEED: FeedItem[] = [
  { kind: "bid", initials: "A", provider: "Amara G.", rating: 4.9, amount: 65, messageKey: "bid1Message", eco: true },
  { kind: "job", city: "Rotterdam", title: "Deep clean · 2-bed apartment", budget: "€70–90" },
  { kind: "bid", initials: "L", provider: "Lucas M.", rating: 4.8, amount: 58, messageKey: "bid2Message", eco: true },
  { kind: "bid", initials: "S", provider: "Sofia P.", rating: 5.0, amount: 72, messageKey: "bid3Message", eco: true },
  { kind: "job", city: "Amsterdam", title: "End-of-tenancy · studio flat", budget: "€55–75" },
  { kind: "bid", initials: "M", provider: "Mateo R.", rating: 4.7, amount: 61, message: "Available tomorrow morning — eco-certified, pet-friendly products.", eco: true },
  { kind: "bid", initials: "N", provider: "Nadia K.", rating: 4.9, amount: 69, message: "10 yrs experience, zero-waste. I bring all supplies + equipment.", eco: true },
]

export async function JobPostSection() {
  const t = await getTranslations("homeJobPost")
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-14 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#D1F0E0] text-[#2D7A5F] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              {t("badge")}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-4">
              {t("headingLine1")}<br />
              <span className="text-[#2D7A5F]">{t("headingLine2")}</span>
            </h2>
            <p className="text-[#6B7280] mb-6 leading-relaxed text-sm">
              {t("description")}
            </p>
            <ul className="space-y-2.5 mb-8">
              {[
                t("feature1"),
                t("feature2"),
                t("feature3"),
                t("feature4"),
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[#2B3441]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2D7A5F] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/post-job">
              <Button className="bg-[#2D7A5F] hover:bg-[#235f49] text-white">
                {t("postJobCta")}
              </Button>
            </Link>
          </div>

          {/* Right — live feed (bids + jobs) auto-scrolling within a fixed viewport */}
          <div>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
              {t("liveBidsLabel")}
            </p>
            <div className="relative h-80 overflow-hidden">
              {/* edge fades into the white section background */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 z-10 bg-gradient-to-b from-white to-transparent" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 z-10 bg-gradient-to-t from-white to-transparent" />
              {/* the list is duplicated so the -50% → 0 scroll loops seamlessly; mb-3 (not space-y)
                  keeps every card's spacing equal so the loop has no jump */}
              <div className="animate-marquee-y">
                {[...FEED, ...FEED].map((item, i) =>
                  item.kind === "job" ? (
                    <div key={i} className="mb-3 bg-white rounded-xl p-4 border border-dashed border-[#2D7A5F]/40 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#D1F0E0] flex items-center justify-center text-base flex-shrink-0">📋</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-[#2D7A5F] uppercase tracking-wide">New job · {item.city}</span>
                          <span className="font-bold text-[#2B3441] text-sm flex-shrink-0">{item.budget}</span>
                        </div>
                        <p className="text-sm font-semibold text-[#2B3441] truncate">{item.title}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="mb-3 bg-[#F4FAF6] rounded-xl p-4 border border-[#E5EDE9] flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2D7A5F] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {item.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-[#2B3441] truncate">{item.provider}</span>
                            {item.eco && (
                              <span className="text-[10px] bg-[#D1F0E0] text-[#2D7A5F] px-2 py-0.5 rounded-full flex-shrink-0">
                                🌿 {t("ecoBadge")}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-[#2B3441] text-sm flex-shrink-0">€{item.amount}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs text-[#6B7280]">{item.rating}</span>
                        </div>
                        <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-1">{item.message ?? (item.messageKey ? t(item.messageKey) : "")}</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
