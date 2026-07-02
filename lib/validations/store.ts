import { z } from "zod"

// z.string().url() is scheme-blind — it accepts javascript:/data:/vbscript:. Restrict to http(s) so a
// stored URL can't become an open-redirect (via /api/store/go) or a data:-URI image vector.
const httpUrl = z
  .string()
  .url()
  .max(2000)
  .refine(
    (u) => { try { return ["http:", "https:"].includes(new URL(u).protocol) } catch { return false } },
    "Must be an http(s) URL",
  )

const baseStoreProductSchema = z
  .object({
    type: z.enum(["product", "starter_pack"]).default("product"),
    title: z.string().min(2).max(300),
    slug: z.string().regex(/^[a-z0-9-]+$/).max(200).optional(),
    description: z.string().max(4000).optional().nullable(),
    brand: z.string().max(160).optional().nullable(),
    imageUrl: httpUrl.optional().nullable().or(z.literal("")),
    // Optional for starter packs — a pack that's a LIST of member products needs no external link of
    // its own (each member has one). Still required for standalone products.
    affiliateUrl: httpUrl.or(z.literal("")).optional(),
    priceCents: z.number().int().min(0).max(100000000).optional().nullable(),
    currency: z.string().length(3).optional().nullable(),
    benefits: z.array(z.string().max(200)).max(20).default([]),
    category: z.string().max(100).optional().nullable(),
    // Assigns this product to a starter-pack row (type=starter_pack).
    packId: z.string().uuid().optional().nullable(),
    tags: z.array(z.string().max(50)).max(20).default([]),
    featured: z.boolean().default(false),
    status: z.enum(["draft", "published"]).default("draft"),
  })
  .refine((d) => d.type === "starter_pack" || (d.affiliateUrl && d.affiliateUrl.length > 0), {
    message: "affiliateUrl is required for products",
    path: ["affiliateUrl"],
  })

export const storeProductSchema = baseStoreProductSchema

export const updateStoreProductSchema = z.object({
  type: z.enum(["product", "starter_pack"]).optional(),
  title: z.string().min(2).max(300).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  brand: z.string().max(160).optional().nullable(),
  imageUrl: httpUrl.optional().nullable().or(z.literal("")),
  affiliateUrl: httpUrl.or(z.literal("")).optional(),
  priceCents: z.number().int().min(0).max(100000000).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  benefits: z.array(z.string().max(200)).max(20).optional(),
  category: z.string().max(100).optional().nullable(),
  packId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  featured: z.boolean().optional(),
  status: z.enum(["draft", "published"]).optional(),
})

export type StoreProductInput = z.infer<typeof storeProductSchema>
export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>
