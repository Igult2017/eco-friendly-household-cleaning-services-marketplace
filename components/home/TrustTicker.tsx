const TICKERS = [
  "BACKGROUND-CHECKED PROVIDERS",
  "ECO-VERIFIED PRODUCTS",
  "CASHLESS STRIPE PAYMENTS",
  "5-STAR CUSTOMER SUPPORT",
  "GDPR COMPLIANT",
  "EU INSURED PROVIDERS",
  "48H REFUND POLICY",
  "REAL-TIME NOTIFICATIONS",
]

export function TrustTicker() {
  const items = [...TICKERS, ...TICKERS]

  return (
    <div className="bg-[#2D7A5F] py-3.5 overflow-hidden">
      <div
        className="flex whitespace-nowrap"
        style={{ animation: "ticker 35s linear infinite" }}
      >
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold tracking-widest mx-10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CB87A] inline-block flex-shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
