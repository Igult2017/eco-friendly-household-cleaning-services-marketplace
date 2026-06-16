import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo/site"

// Private/auth-gated areas with no search value. Note "/provider/" keeps a
// trailing slash so it never matches the PUBLIC "/providers/{slug}" profiles.
const PRIVATE = [
  "/admin",
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
