import { z } from "zod"

const base = z.object({
  firstName: z.string().min(1, "Required").max(50),
  lastName: z.string().min(1, "Required").max(50),
  phone: z.string().optional(),
  gdprConsent: z.literal(true, "You must accept the terms to continue"),
})

const customerSchema = base.extend({ role: z.literal("customer") })

const providerSchema = base.extend({
  role: z.literal("provider"),
  businessName: z.string().min(2, "Minimum 2 characters").max(100),
  bio: z.string().min(20, "Tell us more — minimum 20 characters").max(800),
  city: z.string().min(2, "Required").max(100),
  postalCode: z.string().min(3, "Required").max(20),
  country: z.string().length(2).default("DE"),
  serviceRadiusKm: z.number().int().min(1).max(100).default(25),
  ecoLevel: z.enum(["basic", "certified", "premium", "zero_impact"]).default("basic"),
})

// Standalone affiliate/influencer — no customer or cleaner data required.
const affiliateSchema = base.extend({ role: z.literal("affiliate") })

export const onboardingSchema = z.discriminatedUnion("role", [customerSchema, providerSchema, affiliateSchema])
export type OnboardingInput = z.infer<typeof onboardingSchema>
