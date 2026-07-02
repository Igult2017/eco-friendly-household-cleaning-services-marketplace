import { z } from "zod"

export const addressSchema = z.object({
  line1: z.string().min(2).max(200),
  line2: z.string().max(100).optional(),
  city: z.string().min(2).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(3).max(10),
  country: z.string().length(2).default("DE"),
})

export const createBookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  paymentIntentId: z.string().min(1),
  scheduledAt: z
    .string()
    .datetime()
    .refine((v) => new Date(v) > new Date(), { message: "scheduledAt must be in the future" }),
  durationMinutes: z.number().int().min(30).max(480),
  serviceAddress: addressSchema,
  serviceLatitude: z.number().optional(),
  serviceLongitude: z.number().optional(),
  specialInstructions: z.string().max(1000).optional(),
  ecoOptions: z.array(z.string().max(100)).max(20).default([]),
  carbonOffsetCents: z.union([z.literal(0), z.literal(200)]).optional().default(0),
  requestedFrequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  requestedDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
})

export const paymentIntentSchema = z.object({
  providerId: z.string().uuid(),
  // Optional in the BID flow (job posts carry no category; the route resolves the provider's first
  // active service). Still effectively required for wizard bookings — the route enforces it.
  serviceId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(30).max(480),
  carbonOffsetCents: z.union([z.literal(0), z.literal(200)]).optional().default(0),
  bidAmountCents: z.number().int().positive().optional(), // overrides service.basePrice for bid-flow bookings
  promoCodeId: z.string().uuid().optional(),
  promoCodeDiscountCents: z.number().int().min(0).optional(),
  addOnIds: z.array(z.string().uuid()).max(20).optional().default([]),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>
