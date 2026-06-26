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
  // M6: only accept an uploaded file (our own storage / file proxy), not an arbitrary external URL
  // (which would leak viewers' IP+UA to an attacker host and allow hotlinking). Enforced server-side;
  // on the client R2_PUBLIC_URL is undefined so the check is skipped (server is authoritative).
  profilePhotoUrl: z
    .string()
    .url()
    .refine(
      (u) => {
        const base = process.env.R2_PUBLIC_URL
        return !base || u.startsWith(base) || u.startsWith("/api/files/")
      },
      { message: "Profile photo must be an uploaded image" },
    )
    .optional(),
  // Cleaner-set loyalty discount applied to their recurring bookings (0–50%).
  recurringDiscountPct: z.number().int().min(0).max(50).optional(),
  // IANA timezone captured from the cleaner's browser (Intl). Drives availability + time display.
  timezone: z.string().min(1).max(64).optional(),
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
