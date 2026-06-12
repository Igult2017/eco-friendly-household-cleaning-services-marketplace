import { Search, Calendar, Star } from "lucide-react"

const STEPS = [
  {
    number: "01",
    Icon: Search,
    title: "Search by location",
    desc: "Enter your postcode to find eco-certified cleaning professionals near you, filtered by service type, price, and availability.",
  },
  {
    number: "02",
    Icon: Calendar,
    title: "Book in minutes",
    desc: "Choose your cleaner, pick a time slot, and confirm with secure card pre-authorisation. Payment is only captured after the job is done.",
  },
  {
    number: "03",
    Icon: Star,
    title: "Relax & review",
    desc: "Your cleaner arrives with eco-friendly products. Rate their work, track your carbon savings, and earn loyalty credits.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-[#2B3441] mb-3">
            How DORIXÉ works
          </h2>
          <p className="text-[#6B7280] max-w-xl mx-auto text-sm">
            From search to spotless in three simple steps — no hidden fees, no hassle.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map(({ number, Icon, title, desc }) => (
            <div key={number}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-5xl font-serif font-bold text-[#D1F0E0] leading-none">{number}</span>
                <div className="w-10 h-10 rounded-xl bg-[#F4FAF6] border border-[#E5EDE9] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#2D7A5F]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[#2B3441] mb-2">{title}</h3>
              <p className="text-[#6B7280] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
