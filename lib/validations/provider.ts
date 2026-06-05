import { z } from "zod"

export const providerProfileSchema = z.object({
  businessName: z.string().min(2).max(100),
  bio: z.string().min(20).max(800),
  city: z.string().min(2).max(100),
  postalCode: z.string().min(3).max(10),
  country: z.string().length(2).default("DE"),
  serviceRadiusKm: z.number().int().min(1).max(100).default(25),
  ecoLevel: z.enum(["basic", "certified", "premium", "zero_impact"]).default("basic"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  profilePhotoUrl: z.string().url().optional(),
})

export const providerServicesSchema = z.object({
  services: z.array(
    z.object({
      categoryId: z.string().uuid(),
      basePriceCents: z.number().int().min(100).max(100_000),
      priceUnit: z.enum(["per_job", "per_hour", "per_sqft"]).default("per_hour"),
      minDurationMinutes: z.number().int().min(30).max(480).default(60),
      ecoProductsUsed: z.array(z.string()).default([]),
    })
  ).min(1),
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ).min(1),
})

export const roleSelectionSchema = z.object({
  role: z.enum(["customer", "provider"]),
})

export type ProviderProfileInput = z.infer<typeof providerProfileSchema>
export type ProviderServicesInput = z.infer<typeof providerServicesSchema>
