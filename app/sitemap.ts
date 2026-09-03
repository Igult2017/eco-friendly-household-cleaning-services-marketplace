import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { providers, blogPosts } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SITE_URL } from "@/lib/seo/site"
import { routing } from "@/i18n/routing"
import { localeAlternates } from "@/lib/seo/alternates"

export const revalidate = 3600 // refresh hourly

// Public, indexable routes. Auth-gated areas are excluded (see robots.ts).
const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "daily" },
  { path: "/browse", priority: 0.9, changeFrequency: "daily" },
  { path: "/browse-jobs", priority: 0.6, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.7, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/sustainability", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/become-a-cleaner", priority: 0.8, changeFrequency: "monthly" },
  { path: "/affiliate", priority: 0.6, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/eco-store", priority: 0.7, changeFrequency: "weekly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/impressum", priority: 0.3, changeFrequency: "yearly" },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Every marketing page exists in all 8 languages and the pages already advertise each other via
  // hreflang — but only the English URLs were ever submitted here, so ~8x the indexable surface was
  // never offered to Google for crawling. Emit one entry per language, each carrying the full set of
  // alternates. URLs are built with the SAME helper the pages' hreflang tags use
  // (lib/seo/alternates.ts), so the sitemap and the tags can never disagree about a URL.
  // Blog posts and provider profiles stay English-only on purpose: their body text isn't translated,
  // so listing 8 near-identical copies would be thin duplicate content rather than reach.
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((r) => {
    const { languages } = localeAlternates(r.path, routing.defaultLocale)
    return routing.locales.map((locale) => ({
      url: languages[locale],
      lastModified: now,
      changeFrequency: r.changeFrequency,
      // The default-language page stays the primary; translations sit just below it.
      priority: locale === routing.defaultLocale ? r.priority : Math.max(0.1, r.priority - 0.1),
      alternates: { languages },
    }))
  })

  // Approved provider profiles — the high-volume, long-tail indexable pages.
  let providerEntries: MetadataRoute.Sitemap = []
  try {
    const rows = await db
      .select({ slug: providers.slug, updatedAt: providers.updatedAt })
      .from(providers)
      .where(eq(providers.isApproved, true))
      .limit(5000)
    providerEntries = rows.map((p) => ({
      url: `${SITE_URL}/providers/${p.slug}`,
      lastModified: p.updatedAt ?? now,
      changeFrequency: "weekly",
      priority: 0.7,
    }))
  } catch {
    // DB unreachable (e.g. local build) — ship the static sitemap rather than fail.
  }

  // Published blog posts — high-value, AI-citable long-form content.
  let blogEntries: MetadataRoute.Sitemap = []
  try {
    const rows = await db
      .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
      .from(blogPosts)
      .where(eq(blogPosts.status, "published"))
      .limit(5000)
    blogEntries = rows.map((b) => ({
      url: `${SITE_URL}/blog/${b.slug}`,
      lastModified: b.updatedAt ?? now,
      changeFrequency: "monthly",
      priority: 0.6,
    }))
  } catch {
    // DB unreachable — ship without blog entries rather than fail the sitemap.
  }

  return [...staticEntries, ...providerEntries, ...blogEntries]
}
