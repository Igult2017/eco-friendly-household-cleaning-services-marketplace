import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/site"

// Private/auth-gated areas with no search value. Note "/provider/" keeps a
// trailing slash so it never matches the PUBLIC "/providers/{slug}" profiles.
//
// "/admin" is deliberately NOT listed. robots.txt is world-readable and is the first thing an
// attacker fetches, so naming the control panel there publishes its location to everyone while
// protecting nothing: /admin is behind auth already — an anonymous request and a Googlebot request
// both get a 307 to /sign-in, so there is no content for a crawler to index whether or not it is
// disallowed here. Disallowing it bought zero indexing protection and gave away the path. Keep it
// out; the middleware, not this file, is what keeps /admin private.
const PRIVATE = [
  "/api",
  "/dashboard",
  "/provider/",
  "/book",
  "/post-job",
  "/onboarding",
  "/recurring",
  "/bookings",
  "/sign-in",
  "/sign-up",
  "/_a",
]

// Answer engines we explicitly welcome so DORIXÉ can be surfaced and cited in
// AI search (ChatGPT, Claude, Perplexity, Gemini, Apple, etc.).
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
  "CCBot",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
