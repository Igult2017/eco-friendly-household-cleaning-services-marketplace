import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { providers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SITE_URL } from "@/lib/seo/site"

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
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/impressum", priority: 0.3, changeFrequency: "yearly" },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

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

  return [...staticEntries, ...providerEntries]
}
