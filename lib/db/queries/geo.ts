import { db } from "../index"
import { providerServices, serviceCategories } from "../schema"
import { sql, and, eq, inArray } from "drizzle-orm"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// categoryId may arrive as a UUID (a real category id) OR a slug (the homepage service grid links to
// /book?service=<slug>, which flows through as categoryId). Resolve it to a UUID. A value that is
// neither a UUID nor a known slug drops the filter rather than crashing the query — Postgres rejects a
// non-uuid value compared against the uuid category_id column ("invalid input syntax for type uuid").
async function resolveCategoryId(raw?: string): Promise<string | undefined> {
  if (!raw) return undefined
  if (UUID_RE.test(raw)) return raw
  const [cat] = await db
    .select({ id: serviceCategories.id })
    .from(serviceCategories)
    .where(eq(serviceCategories.slug, raw))
  return cat?.id
}

export interface GeoProvider {
  id: string; userId: string; slug: string; businessName: string; bio: string | null
  city: string | null; postalCode: string | null; country: string
  ecoLevel: string; ecoScore: number; averageRating: number | null
  totalReviews: number; totalJobsCompleted: number; profilePhotoUrl: string | null
  isApproved: boolean; verificationStatus?: string | null; distanceMeters: number
  // Cheapest active service — surfaced on result cards as a "from" price.
  serviceBasePrice?: number | null; priceUnit?: string | null
}

// Attach each provider's cheapest active service price (one extra query, no
// changes to the PostGIS/Haversine SQL). Mirrors the browse page approach.
async function attachCheapestPrice(list: GeoProvider[]): Promise<GeoProvider[]> {
  if (list.length === 0) return list
  const ids = list.map((p) => p.id)
  const svc = await db
    .select({
      providerId: providerServices.providerId,
      basePrice: providerServices.basePrice,
      priceUnit: providerServices.priceUnit,
    })
    .from(providerServices)
    .where(and(eq(providerServices.isActive, true), inArray(providerServices.providerId, ids)))

  const cheapest = new Map<string, { price: number; unit: string }>()
  for (const s of svc) {
    const cur = cheapest.get(s.providerId)
    if (!cur || s.basePrice < cur.price) cheapest.set(s.providerId, { price: s.basePrice, unit: s.priceUnit })
  }
  return list.map((p) => ({
    ...p,
    serviceBasePrice: cheapest.get(p.id)?.price ?? null,
    priceUnit: cheapest.get(p.id)?.unit ?? null,
  }))
}

// Haversine bounding-box + exact distance — pure PostgreSQL, no PostGIS needed.
// useProviderRadius: gate each cleaner by THEIR OWN service_radius_km (does this cleaner serve the
// client's point?) instead of one fixed radius around the client.
async function findProvidersHaversine(params: {
  latitude: number; longitude: number; radiusKm: number
  categoryId?: string; limit: number; useProviderRadius?: boolean
}): Promise<GeoProvider[]> {
  const { latitude, longitude, radiusKm, categoryId, limit, useProviderRadius } = params
  // 1° lat ≈ 111.32 km. Longitude degree shrinks towards poles.
  const boxKm = useProviderRadius ? 150 : radiusKm // box must cover the largest plausible provider radius
  const latDelta = boxKm / 111.32
  const lngDelta = boxKm / (111.32 * Math.cos((latitude * Math.PI) / 180))

  const result = await db.execute(sql`
    WITH distances AS (
      SELECT
        p.id, p.user_id AS "userId", p.slug, p.business_name AS "businessName",
        p.bio, p.city, p.postal_code AS "postalCode", p.country,
        p.eco_level AS "ecoLevel", p.eco_score AS "ecoScore",
        p.average_rating AS "averageRating", p.total_reviews AS "totalReviews",
        p.total_jobs_completed AS "totalJobsCompleted",
        p.profile_photo_url AS "profilePhotoUrl", p.is_approved AS "isApproved",
        p.verification_status AS "verificationStatus",
        GREATEST(COALESCE(p.service_radius_km, 25), 1) * 1000 AS "serviceRadiusM",
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS((p.latitude - ${latitude}) / 2)), 2) +
          COS(RADIANS(${latitude})) * COS(RADIANS(p.latitude)) *
          POWER(SIN(RADIANS((p.longitude - ${longitude}) / 2)), 2)
        )) AS "distanceMeters"
      FROM providers p
      WHERE p.is_approved = true AND p.is_suspended = false
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND p.latitude  BETWEEN ${latitude  - latDelta} AND ${latitude  + latDelta}
        AND p.longitude BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}
        ${categoryId
          ? sql`AND EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = p.id AND ps.is_active = true AND (ps.category_id = ${categoryId} OR ps.category_ids @> jsonb_build_array(${categoryId}::text)))`
          : sql``}
    )
    SELECT * FROM distances
    WHERE "distanceMeters" <= ${useProviderRadius ? sql`"serviceRadiusM"` : sql`${radiusKm * 1000}`}
    ORDER BY "distanceMeters" ASC, "averageRating" DESC NULLS LAST
    LIMIT ${limit}
  `)
  return Array.from(result) as unknown as GeoProvider[]
}

/**
 * Find approved providers within radiusKm of a coordinate.
 * Tries PostGIS first (fast, indexed). Falls back to Haversine SQL if
 * PostGIS is not installed on the server.
 */
export async function findProvidersNearLocation(params: {
  latitude: number; longitude: number; radiusKm: number
  categoryId?: string; limit?: number; useProviderRadius?: boolean
}): Promise<GeoProvider[]> {
  const { latitude, longitude, radiusKm, limit = 20, useProviderRadius } = params
  const categoryId = await resolveCategoryId(params.categoryId)
  const radiusExpr = useProviderRadius
    ? sql`GREATEST(COALESCE(p.service_radius_km, 25), 1) * 1000`
    : sql`${radiusKm * 1000}`
  let providersList: GeoProvider[]
  try {
    const result = await db.execute(sql`
      SELECT
        p.id, p.user_id AS "userId", p.slug, p.business_name AS "businessName",
        p.bio, p.city, p.postal_code AS "postalCode", p.country,
        p.eco_level AS "ecoLevel", p.eco_score AS "ecoScore",
        p.average_rating AS "averageRating", p.total_reviews AS "totalReviews",
        p.total_jobs_completed AS "totalJobsCompleted",
        p.profile_photo_url AS "profilePhotoUrl", p.is_approved AS "isApproved",
        p.verification_status AS "verificationStatus",
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)
          AS "distanceMeters"
      FROM providers p
      WHERE p.is_approved = true AND p.is_suspended = false AND p.location IS NOT NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusExpr})
        ${categoryId
          ? sql`AND EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = p.id AND ps.is_active = true AND (ps.category_id = ${categoryId} OR ps.category_ids @> jsonb_build_array(${categoryId}::text)))`
          : sql``}
      ORDER BY "distanceMeters" ASC, p.average_rating DESC NULLS LAST
      LIMIT ${limit}
    `)
    providersList = Array.from(result) as unknown as GeoProvider[]
  } catch {
    // PostGIS not installed — fall back to pure-SQL Haversine
    providersList = await findProvidersHaversine({ latitude, longitude, radiusKm, categoryId, limit, useProviderRadius })
  }
  return attachCheapestPrice(providersList)
}

/**
 * Find job posts visible to a provider at given coordinates.
 */
export async function findJobsNearProvider(params: {
  latitude: number; longitude: number; radiusKm?: number; limit?: number
}): Promise<{ jobPostId: string; distanceMeters: number }[]> {
  const { latitude, longitude, radiusKm = 50, limit = 50 } = params
  try {
    const result = await db.execute(sql`
      SELECT jp.id AS "jobPostId",
        ST_Distance(jp.service_location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)
          AS "distanceMeters"
      FROM job_posts jp
      WHERE jp.status IN ('open', 'bidding') AND jp.expires_at > NOW()
        AND jp.service_location IS NOT NULL
        AND ST_DWithin(jp.service_location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusKm * 1000})
      ORDER BY jp.created_at DESC LIMIT ${limit}
    `)
    return Array.from(result) as { jobPostId: string; distanceMeters: number }[]
  } catch {
    // PostGIS unavailable — basic lat/lng bounding box fallback
    const latDelta = radiusKm / 111.32
    const lngDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180))
    const result = await db.execute(sql`
      SELECT jp.id AS "jobPostId", 0 AS "distanceMeters"
      FROM job_posts jp
      WHERE jp.status IN ('open', 'bidding') AND jp.expires_at > NOW()
        AND jp.service_latitude  BETWEEN ${latitude  - latDelta} AND ${latitude  + latDelta}
        AND jp.service_longitude BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}
      ORDER BY jp.created_at DESC LIMIT ${limit}
    `)
    return Array.from(result) as { jobPostId: string; distanceMeters: number }[]
  }
}
