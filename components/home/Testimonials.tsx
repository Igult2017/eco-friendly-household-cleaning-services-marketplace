import { Star } from "lucide-react"

const REVIEWS = [
  {
    name: "Emma T.",
    city: "Amsterdam",
    rating: 5,
    text: "My flat has never been this clean. The cleaner used plant-based products that smelled amazing and didn't irritate my allergies. Booking was instant — I had confirmation in under 2 minutes.",
    service: "Regular Cleaning",
  },
  {
    name: "Marco B.",
    city: "Berlin",
    rating: 5,
    text: "Used DORIX for our office monthly clean. The eco-certified team is professional, punctual, and the booking dashboard is a dream. Our whole company switched.",
    service: "Office Cleaning",
  },
  {
    name: "Claire D.",
    city: "Paris",
    rating: 5,
    text: "Post-move deep clean was flawless. I used the bidding system and had 4 competitive offers within an hour. The eco-score transparency is a genuinely nice touch.",
    service: "Deep Cleaning",
  },
]

export function Testimonials() {
  return (
    <section className="py-20 bg-[#F4FAF6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            Loved by thousands across Europe
          </h2>
          <p className="text-[#6B7280] text-sm">Real reviews from verified DORIX customers</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {REVIEWS.map((review) => (
            <div key={review.name} className="bg-white rounded-2xl p-6 border border-[#E5EDE9] shadow-sm">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-[#2B3441] text-sm leading-relaxed mb-5 italic">"{review.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#2B3441]">{review.name}</p>
                  <p className="text-xs text-[#6B7280]">{review.city}</p>
                </div>
                <span className="text-[10px] bg-[#F4FAF6] text-[#6B7280] border border-[#E5EDE9] rounded-full px-2.5 py-1">
                  {review.service}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
