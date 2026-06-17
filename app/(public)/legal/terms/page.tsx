import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — DORIXÉ",
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="font-serif text-4xl font-bold text-[#2B3441] mb-2">Terms of Service</h1>
      <p className="text-[#6B7280] text-sm mb-8">Last updated: June 2025</p>

      <div className="space-y-8 text-sm text-[#2B3441]/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">1. Acceptance</h2>
          <p>By accessing or using DORIXÉ, you agree to these Terms. If you do not agree, do not use the platform.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">2. Services</h2>
          <p>DORIXÉ is a marketplace connecting Clients with independent eco-friendly Cleaning Professionals. We are not the employer of any Cleaning Professional. DORIXÉ is not responsible for the quality of services delivered by Cleaning Professionals but mediates disputes in good faith.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">3. Commission</h2>
          <p>DORIXÉ deducts a small commission from each completed booking — the Cleaning Professional&apos;s fee for using the platform to reach Clients. The Client pays the Cleaning Professional&apos;s quoted rate; the commission is not added on top. The commission rate is set by DORIXÉ and may be adjusted from time to time, and it covers platform costs, payment processing, and support.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">4. Payments</h2>
          <p>All payments are processed by Stripe. Funds are held in escrow until the service is completed. Cleaning Professionals are paid via Stripe Connect after job completion (net of the platform commission), subject to a standard 7-day rolling payout schedule.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">5. Cancellation & Refunds</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>More than 48h before service: 100% refund</li>
            <li>24–48h before service: 50% refund</li>
            <li>Less than 24h before service: no refund</li>
            <li>Cleaning Professional cancellation: 100% refund, no exceptions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">6. Prohibited uses</h2>
          <p>You may not use DORIXÉ to: circumvent platform payments, solicit Cleaning Professionals off-platform, post false reviews, discriminate unlawfully, or violate applicable EU laws.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">7. Limitation of liability</h2>
          <p>To the maximum extent permitted by EU law, DORIXÉ shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount paid to DORIXÉ in the 12 months preceding the claim.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">8. Governing law</h2>
          <p>These Terms are governed by the laws of the European Union and the applicable national law of Germany. Disputes shall be submitted to the courts of Berlin, Germany.</p>
        </section>
      </div>
    </div>
  )
}
