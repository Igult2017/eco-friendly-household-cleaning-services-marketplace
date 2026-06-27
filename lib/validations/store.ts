import { z } from "zod"

export const storeProductSchema = z.object({
  type: z.enum(["product", "starter_pack"]).default("product"),
  title: z.string().min(2).max(300),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  brand: z.string().max(160).optional().nullable(),
  imageUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  affiliateUrl: z.string().url().max(2000),
  priceCents: z.number().int().min(0).max(100000000).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  benefits: z.array(z.string().max(200)).max(20).default([]),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published"]).default("draft"),
})

export const updateStoreProductSchema = storeProductSchema.partial()

export type StoreProductInput = z.infer<typeof storeProductSchema>
export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>
