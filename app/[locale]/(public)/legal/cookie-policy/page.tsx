import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cookie Policy — DORIXÉ",
}

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <h1 className="font-serif text-4xl font-bold text-[#2B3441] mb-2">Cookie Policy</h1>
      <p className="text-[#6B7280] text-sm mb-8">Last updated: June 2025</p>

      <div className="space-y-8 text-sm text-[#2B3441]/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">What are cookies?</h2>
          <p>Cookies are small text files stored on your device. They help us provide a consistent, personalised experience.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">Cookies we use</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {["Name", "Purpose", "Duration", "Type"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#6B7280] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ["__clerk_session", "Authentication session", "Session", "Essential"],
                  ["__stripe_mid", "Stripe fraud prevention", "1 year", "Essential"],
                  ["dorix_cookie_consent", "Your cookie preferences", "1 year", "Essential"],
                ].map(([name, purpose, duration, type], i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-mono text-[#2B3441]">{name}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{purpose}</td>
                    <td className="px-4 py-3 text-[#6B7280]">{duration}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        type === "Essential" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>{type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">Managing cookies</h2>
          <p>You can withdraw your consent at any time by clearing your browser cookies or clicking "Decline" on the cookie banner. Note that essential cookies cannot be disabled — they are required for the platform to function.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#2B3441] mb-3">Contact</h2>
          <p>Email us at <a href="mailto:privacy@dorix.eu" className="text-[#2D7A5F] underline">privacy@dorix.eu</a> for any cookie-related questions.</p>
        </section>
      </div>
    </div>
  )
}
