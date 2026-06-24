import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — DORIXÉ",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4 prose prose-slate">
      <h1 className="font-serif text-4xl font-bold text-[#2B3441] mb-2">Privacy Policy</h1>
      <p className="text-[#6B7280] text-sm mb-8">Last updated: June 2025</p>

      <section className="space-y-6 text-[#2B3441]/80 text-sm leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">1. Who we are</h2>
          <p>DORIXÉ operates an eco-friendly household cleaning services marketplace. Our registered address and data controller details are available upon request at <a href="mailto:privacy@dorix.eu" className="text-[#2D7A5F] underline">privacy@dorix.eu</a>.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">2. What data we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: name, email, phone number</li>
            <li>Service address and location (for matching providers)</li>
            <li>Payment information (processed securely by Stripe — we do not store card details)</li>
            <li>Usage data: pages visited, features used, device type</li>
            <li>Communications: messages with providers, dispute evidence</li>
            <li>Eco preferences and carbon offset contributions</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">3. Legal basis (GDPR Article 6)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Contract performance</strong>: processing bookings, payments, and communications</li>
            <li><strong>Legitimate interests</strong>: fraud prevention, platform security, analytics</li>
            <li><strong>Consent</strong>: marketing emails (you can withdraw at any time)</li>
            <li><strong>Legal obligation</strong>: tax records, regulatory reporting</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">4. How we use your data</h2>
          <p>We use your data to match you with service providers, process payments, send transactional emails, prevent fraud, and improve the platform. We do not sell your personal data to third parties.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">5. Data retention</h2>
          <p>We retain account data for the duration of your account and up to 3 years after deletion for legal compliance. Payment records are retained for 7 years per EU tax law.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">6. Your rights (GDPR)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access</strong>: request a copy of your personal data (Article 15)</li>
            <li><strong>Rectification</strong>: correct inaccurate data (Article 16)</li>
            <li><strong>Erasure</strong>: request deletion of your data (Article 17)</li>
            <li><strong>Portability</strong>: receive your data in machine-readable format (Article 20)</li>
            <li><strong>Objection</strong>: object to processing based on legitimate interests (Article 21)</li>
          </ul>
          <p className="mt-2">To exercise any of these rights, email <a href="mailto:privacy@dorix.eu" className="text-[#2D7A5F] underline">privacy@dorix.eu</a>. We respond within 30 days.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">7. Third-party processors</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Stripe (payments) — EU data centre</li>
            <li>Clerk (authentication) — EU data processing addendum available</li>
            <li>Resend (transactional email)</li>
            <li>Cloudflare R2 (file storage)</li>
            <li>Pusher (real-time notifications)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#2B3441]">8. Contact</h2>
          <p>Data controller: DORIXÉ<br />Email: <a href="mailto:privacy@dorix.eu" className="text-[#2D7A5F] underline">privacy@dorix.eu</a><br />You may also lodge a complaint with your national supervisory authority.</p>
        </div>
      </section>
    </div>
  )
}
