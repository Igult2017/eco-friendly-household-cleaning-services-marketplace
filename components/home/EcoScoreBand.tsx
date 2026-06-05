const STATS = [
  { value: "4.8★", label: "Average eco-score", suffix: "" },
  { value: "12.4t", label: "CO₂ saved this year", suffix: "" },
  { value: "94%", label: "Use plant-based products", suffix: "" },
  { value: "3,200+", label: "Eco-certified jobs done", suffix: "" },
]

export function EcoScoreBand() {
  return (
    <section className="bg-[#2D7A5F] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
            Our environmental impact
          </h2>
          <p className="text-white/60 text-sm">Every DORIX booking makes the planet a little greener</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl md:text-4xl font-serif font-bold text-white mb-1.5">
                {value}
              </div>
              <div className="text-white/60 text-xs tracking-wide">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-8 border-t border-white/10 text-center">
          <p className="text-white/50 text-xs">
            DORIX offsets 100% of service-related transport emissions · Verified by EcoAudit EU
          </p>
        </div>
      </div>
    </section>
  )
}
