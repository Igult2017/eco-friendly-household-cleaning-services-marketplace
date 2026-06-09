import { BarChart3, ExternalLink } from "lucide-react"

export function UmamiSetup() {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-dashed border-[#2D7A5F]/40 px-8 py-12 text-center">
      <BarChart3 className="h-12 w-12 mx-auto text-[#4CB87A] mb-4" />
      <h2 className="text-lg font-semibold text-[#2B3441] mb-2">Analytics not configured</h2>
      <p className="text-sm text-[#6B7280] max-w-md mx-auto mb-6">
        DORIX uses <strong>Umami</strong> — a self-hosted, GDPR-safe analytics engine. It captures page views,
        countries, social referrers, and day-of-week patterns without cookies or consent banners.
      </p>
      <ol className="text-left text-sm text-[#6B7280] space-y-2 max-w-sm mx-auto mb-6">
        <li><span className="font-semibold text-[#2B3441]">1.</span> Start the stack — Umami runs at <code className="bg-gray-100 px-1 rounded text-xs">http://&lt;VPS-IP&gt;:3001</code></li>
        <li><span className="font-semibold text-[#2B3441]">2.</span> Log in with <code className="bg-gray-100 px-1 rounded text-xs">admin / umami</code> (change immediately)</li>
        <li><span className="font-semibold text-[#2B3441]">3.</span> Add website → copy the Website ID</li>
        <li><span className="font-semibold text-[#2B3441]">4.</span> Settings → API Keys → create a key</li>
        <li>
          <span className="font-semibold text-[#2B3441]">5.</span> Add to <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>:
          <pre className="mt-1 bg-gray-50 rounded p-2 text-xs overflow-x-auto">
{`UMAMI_API_KEY=your-key
UMAMI_WEBSITE_ID=your-website-id
UMAMI_INTERNAL_URL=http://umami:3000
NEXT_PUBLIC_UMAMI_URL=http://<VPS-IP>:3001`}
          </pre>
        </li>
      </ol>
      <a
        href="https://umami.is/docs"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#2D7A5F] hover:underline"
      >
        Umami docs <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
