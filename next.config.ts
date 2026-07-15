import { withSentryConfig } from "@sentry/nextjs"
import createNextIntlPlugin from "next-intl/plugin"
import type { NextConfig } from "next"

const withNextIntl = createNextIntlPlugin()

// Content-Security-Policy. Deployed Report-Only first so it can't white-screen the Clerk / Stripe /
// Pusher widgets — watch the browser console for "Refused to…" violations, tune the allow-list, then
// rename the header to "Content-Security-Policy" to enforce. (ZAP M1 / H1 backstop)
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.xn--dorix-fsa.com https://*.clerk.accounts.dev https://js.stripe.com https://challenges.cloudflare.com",
  "connect-src 'self' https://clerk.xn--dorix-fsa.com https://*.clerk.accounts.dev https://api.stripe.com https://*.pusher.com wss://*.pusher.com https://*.ingest.sentry.io",
  "img-src 'self' data: blob: https://img.clerk.com https://images.unsplash.com https://*.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://clerk.xn--dorix-fsa.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const nextConfig: NextConfig = {
  output: "standalone", // enables minimal self-contained build for Docker
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js" (ZAP L5)
  // Type-checking + linting run as a separate `tsc --noEmit` gate before every
  // deploy. Skipping them inside `next build` avoids the memory-heavy in-build
  // TypeScript pass OOM-killing the resource-limited VPS build container.
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.cloudflare.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "images.unsplash.com" }, // blog cover images from Unsplash
    ],
  },
  // Umami tracker, same-origin under /_a (no mixed-content block from the HTTP Umami
  // instance, no separate analytics subdomain):
  // - /_a/script.js proxies straight to the Umami container.
  // - /_a/api/send maps to our own route handler, which injects the visitor's real IP +
  //   resolved country before forwarding to Umami. A broad /_a/:path* rewrite straight to
  //   Umami must NEVER come back: it skips that handler and records every visit with a
  //   null country (and app/_a/** can't be a route — underscore folders are private).
  async rewrites() {
    const umami = process.env.UMAMI_INTERNAL_URL
    if (!umami) return []
    return [
      { source: "/_a/script.js", destination: `${umami.replace(/\/$/, "")}/script.js` },
      { source: "/_a/api/send", destination: "/api/analytics/send" },
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
        ],
      },
    ]
  },
}

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  // Disabled: it injects data-sentry-* attributes on every rendered element (HTML bloat + build
  // overhead) and was emitting a deprecation warning. Not needed for error capture.
  reactComponentAnnotation: { enabled: false },
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
