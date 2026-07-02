// schema.org JSON-LD builders. Structured data is read by Google for rich
// results AND by AI answer engines (ChatGPT, Perplexity, Gemini) to understand
// and cite the site — so it doubles as our AI-search (GEO) layer.
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from "./site"

type Json = Record<string, unknown>

// Site-wide publisher identity.
export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    // Unaccented spellings people actually type — helps Google connect the query "dorixe"/"dorix"
    // to this brand (the é + IDN domain otherwise weaken that string match).
    alternateName: ["Dorixe", "DORIXE", "Dorix", "dorixe.com"],
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    description: SITE_DESCRIPTION,
    slogan: "Clean Home. Green Future.",
    areaServed: ["Europe", "United States"],
  }
}

// Enables the Google sitelinks search box and tells engines what the site is.
export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: ["Dorixe", "Dorix"],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/browse?city={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  }
}

// The marketplace service itself (homepage) — what we sell, where, in what currency.
export function serviceSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Eco-friendly home cleaning",
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: ["Europe", "United States"],
    description: SITE_DESCRIPTION,
    offers: { "@type": "Offer", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
  }
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

export function faqSchema(qa: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }
}

// A provider's public profile → a local cleaning business with ratings, offers
// and reviews. The richest entity we expose; key for "eco cleaner in {city}".
export function providerSchema(p: {
  slug: string
  businessName: string
  bio: string | null
  city: string | null
  country: string | null
  averageRating: number | null
  totalReviews: number
  profilePhotoUrl: string | null
  services: { name: string; description: string | null; basePrice: number; priceUnit: string }[]
  reviews: { rating: number; title: string | null; body: string | null; createdAt: Date }[]
}): Json {
  const url = absoluteUrl(`/providers/${p.slug}`)
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${url}#business`,
    name: p.businessName,
    url,
    description: p.bio ?? SITE_DESCRIPTION,
    image: p.profilePhotoUrl ?? absoluteUrl("/logo.png"),
    priceRange: "€€",
    ...(p.city ? { address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: p.country ?? undefined } } : {}),
    makesOffer: p.services.map((s) => ({
      "@type": "Offer",
      priceCurrency: "EUR",
      price: (s.basePrice / 100).toFixed(2),
      itemOffered: { "@type": "Service", name: s.name, description: s.description ?? undefined },
    })),
  }

  if (p.totalReviews > 0 && p.averageRating) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.averageRating.toFixed(1),
      reviewCount: p.totalReviews,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (p.reviews.length > 0) {
    schema.review = p.reviews.map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      ...(r.title ? { name: r.title } : {}),
      ...(r.body ? { reviewBody: r.body } : {}),
      datePublished: new Date(r.createdAt).toISOString().split("T")[0],
    }))
  }

  return schema
}

// A published blog post → a BlogPosting Article, so Google and AI answer engines can cite it
// with a clear author, date, and section. Blog content is the most AI-citable asset we publish.
export function articleSchema(p: {
  slug: string
  title: string
  excerpt: string | null
  coverImageUrl: string | null
  authorName: string
  publishedAt: Date | null
  updatedAt: Date | null
  category: string | null
}): Json {
  const url = absoluteUrl(`/blog/${p.slug}`)
  const published = p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    headline: p.title,
    ...(p.excerpt ? { description: p.excerpt } : {}),
    image: p.coverImageUrl ?? absoluteUrl("/logo.png"),
    url,
    mainEntityOfPage: url,
    ...(published ? { datePublished: published } : {}),
    dateModified: p.updatedAt ? new Date(p.updatedAt).toISOString() : published,
    author: { "@type": "Person", name: p.authorName },
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(p.category ? { articleSection: p.category } : {}),
  }
}

// The eco-store listing → an ItemList of recommended Products (with the outbound affiliate Offer when
// a price is set), so AI engines understand what DORIXÉ recommends and can surface the curated picks.
export function storeItemListSchema(
  items: {
    id: string
    title: string
    description: string | null
    brand: string | null
    imageUrl: string | null
    priceCents: number | null
    currency: string | null
  }[],
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "DORIXÉ Eco-store — recommended cleaning products & business starter packs",
    url: absoluteUrl("/eco-store"),
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: it.title,
        ...(it.description ? { description: it.description } : {}),
        ...(it.brand ? { brand: { "@type": "Brand", name: it.brand } } : {}),
        ...(it.imageUrl ? { image: it.imageUrl } : {}),
        ...(it.priceCents != null
          ? {
              offers: {
                "@type": "Offer",
                price: (it.priceCents / 100).toFixed(2),
                priceCurrency: it.currency ?? "EUR",
                availability: "https://schema.org/InStock",
                url: absoluteUrl(`/api/store/go/${it.id}`),
              },
            }
          : {}),
      },
    })),
  }
}
