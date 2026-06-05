import { db } from "../index"
import { sql } from "drizzle-orm"

export interface GeoProvider {
  id: string
  userId: string
  slug: string
  businessName: string
  bio: string | null
  city: string | null
  postalCode: string | null
  country: string
  ecoLevel: string
  ecoScore: number
  averageRating: number | null
  totalReviews: number
  totalJobsCompleted: number
  profilePhotoUrl: string | null
  isApproved: boolean
  distanceMeters: number
}

/**
 * Find approved providers within radiusKm of a coordinate.
 * Requires the PostGIS migration to have run.
 */
export async function findProvidersNearLocation(params: {
  latitude: number
  longitude: number
  radiusKm: number
  categoryId?: string
  limit?: number
}): Promise<GeoProvider[]> {
  const { latitude, longitude, radiusKm, categoryId, limit = 20 } = params

  const result = await db.execute(sql`
    SELECT
      p.id,
      p.user_id AS "userId",
      p.slug,
      p.business_name AS "businessName",
      p.bio,
      p.city,
      p.postal_code AS "postalCode",
      p.country,
      p.eco_level AS "ecoLevel",
      p.eco_score AS "ecoScore",
      p.average_rating AS "averageRating",
      p.total_reviews AS "totalReviews",
      p.total_jobs_completed AS "totalJobsCompleted",
      p.profile_photo_url AS "profilePhotoUrl",
      p.is_approved AS "isApproved",
      ST_Distance(
        p.location,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) AS "distanceMeters"
    FROM providers p
    ${categoryId
      ? sql`JOIN provider_services ps ON ps.provider_id = p.id AND ps.category_id = ${categoryId} AND ps.is_active = true`
      : sql``}
    WHERE
      p.is_approved = true
      AND p.is_suspended = false
      AND p.location IS NOT NULL
      AND ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        ${radiusKm * 1000}
      )
    ORDER BY
      "distanceMeters" ASC,
      p.average_rating DESC NULLS LAST
    LIMIT ${limit}
  `)

  return Array.from(result) as unknown as GeoProvider[]
}

/**
 * Find job posts visible to a provider at given coordinates.
 */
export async function findJobsNearProvider(params: {
  latitude: number
  longitude: number
  radiusKm?: number
  limit?: number
}): Promise<{ jobPostId: string; distanceMeters: number }[]> {
  const { latitude, longitude, radiusKm = 50, limit = 50 } = params

  const result = await db.execute(sql`
    SELECT
      jp.id AS "jobPostId",
      ST_Distance(
        jp.service_location,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      ) AS "distanceMeters"
    FROM job_posts jp
    WHERE
      jp.status IN ('open', 'bidding')
      AND jp.expires_at > NOW()
      AND jp.service_location IS NOT NULL
      AND ST_DWithin(
        jp.service_location,
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
        ${radiusKm * 1000}
      )
    ORDER BY jp.created_at DESC
    LIMIT ${limit}
  `)

  return Array.from(result) as { jobPostId: string; distanceMeters: number }[]
}
