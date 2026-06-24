import { withSentryConfig } from "@sentry/nextjs"
import createNextIntlPlugin from "next-intl/plugin"
import type { NextConfig } from "next"

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  output: "standalone", // enables minimal self-contained build for Docker
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
    ],
  },
  // Proxy the self-hosted Umami tracker through our own HTTPS origin so the
  // script + event collection are same-origin (no mixed-content block from the
  // HTTP Umami instance) and need no separate analytics subdomain.
  async rewrites() {
    const umami = process.env.UMAMI_INTERNAL_URL
    if (!umami) return []
    return [{ source: "/_a/:path*", destination: `${umami.replace(/\/$/, "")}/:path*` }]
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
