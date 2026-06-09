import { db } from "../index"
import { sql } from "drizzle-orm"

export interface GeoProvider {
  id: string; userId: string; slug: string; businessName: string; bio: string | null
  city: string | null; postalCode: string | null; country: string
  ecoLevel: string; ecoScore: number; averageRating: number | null
  totalReviews: number; totalJobsCompleted: number; profilePhotoUrl: string | null
  isApproved: boolean; distanceMeters: number
}

// Haversine bounding-box + exact distance — pure PostgreSQL, no PostGIS needed.
async function findProvidersHaversine(params: {
  latitude: number; longitude: number; radiusKm: number
  categoryId?: string; limit: number
}): Promise<GeoProvider[]> {
  const { latitude, longitude, radiusKm, categoryId, limit } = params
  // 1° lat ≈ 111.32 km. Longitude degree shrinks towards poles.
  const latDelta = radiusKm / 111.32
  const lngDelta = radiusKm / (111.32 * Math.cos((latitude * Math.PI) / 180))
  const radiusM  = radiusKm * 1000

  const result = await db.execute(sql`
    WITH distances AS (
      SELECT
        p.id, p.user_id AS "userId", p.slug, p.business_name AS "businessName",
        p.bio, p.city, p.postal_code AS "postalCode", p.country,
        p.eco_level AS "ecoLevel", p.eco_score AS "ecoScore",
        p.average_rating AS "averageRating", p.total_reviews AS "totalReviews",
        p.total_jobs_completed AS "totalJobsCompleted",
        p.profile_photo_url AS "profilePhotoUrl", p.is_approved AS "isApproved",
        6371000 * 2 * ASIN(SQRT(
          POWER(SIN(RADIANS((p.latitude - ${latitude}) / 2)), 2) +
          COS(RADIANS(${latitude})) * COS(RADIANS(p.latitude)) *
          POWER(SIN(RADIANS((p.longitude - ${longitude}) / 2)), 2)
        )) AS "distanceMeters"
      FROM providers p
      ${categoryId
        ? sql`JOIN provider_services ps ON ps.provider_id = p.id AND ps.category_id = ${categoryId} AND ps.is_active = true`
        : sql``}
      WHERE p.is_approved = true AND p.is_suspended = false
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND p.latitude  BETWEEN ${latitude  - latDelta} AND ${latitude  + latDelta}
        AND p.longitude BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}
    )
    SELECT * FROM distances
    WHERE "distanceMeters" <= ${radiusM}
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
  categoryId?: string; limit?: number
}): Promise<GeoProvider[]> {
  const { latitude, longitude, radiusKm, categoryId, limit = 20 } = params
  try {
    const result = await db.execute(sql`
      SELECT
        p.id, p.user_id AS "userId", p.slug, p.business_name AS "businessName",
        p.bio, p.city, p.postal_code AS "postalCode", p.country,
        p.eco_level AS "ecoLevel", p.eco_score AS "ecoScore",
        p.average_rating AS "averageRating", p.total_reviews AS "totalReviews",
        p.total_jobs_completed AS "totalJobsCompleted",
        p.profile_photo_url AS "profilePhotoUrl", p.is_approved AS "isApproved",
        ST_Distance(p.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography)
          AS "distanceMeters"
      FROM providers p
      ${categoryId
        ? sql`JOIN provider_services ps ON ps.provider_id = p.id AND ps.category_id = ${categoryId} AND ps.is_active = true`
        : sql``}
      WHERE p.is_approved = true AND p.is_suspended = false AND p.location IS NOT NULL
        AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography, ${radiusKm * 1000})
      ORDER BY "distanceMeters" ASC, p.average_rating DESC NULLS LAST
      LIMIT ${limit}
    `)
    return Array.from(result) as unknown as GeoProvider[]
  } catch {
    // PostGIS not installed — fall back to pure-SQL Haversine
    return findProvidersHaversine({ latitude, longitude, radiusKm, categoryId, limit })
  }
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
