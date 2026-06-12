import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, providers } from "@/lib/db/schema"
import type { NewProvider } from "@/lib/db/schema/providers"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

const enableSchema = z.object({
  businessName: z.string().min(2).max(100),
  bio:          z.string().min(20).max(2000),
  city:         z.string().min(2).max(100),
  postalCode:   z.string().min(3).max(10),
  country:      z.string().length(2),
  serviceRadiusKm: z.number().int().min(1).max(100).default(25),
  ecoLevel: z.enum(["basic", "certified", "premium", "zero_impact"]).default("basic"),
}).optional()

function toSlug(name: string, suffix: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").substring(0, 40) + "-" + suffix
}

export async function POST(req: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const meta = sessionClaims?.metadata as { role?: string; dualRole?: boolean } | undefined
    const primaryRole = meta?.role ?? "customer"

    if (meta?.dualRole === true) {
      return NextResponse.json({ error: "Dual role already enabled" }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))

    // Providers enabling dual role (adding customer/posting side) — no new profile needed
    if (primaryRole === "provider") {
      const clerk = await clerkClient()
      await clerk.users.updateUser(userId, {
        publicMetadata: { ...(sessionClaims?.metadata as object ?? {}), dualRole: true },
      })
      await db.update(users).set({ dualRoleEnabled: true, updatedAt: new Date() }).where(eq(users.id, userId))

      const res = NextResponse.json({ success: true, redirectTo: "/dashboard" })
      res.cookies.set("dorix_active_role", "customer", {
        httpOnly: true, sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, path: "/",
      })
      return res
    }

    // Customers / admins enabling cleaner (provider) side — need provider profile data
    const parsed = enableSchema.safeParse(body)
    if (!parsed.success || !parsed.data) {
      return NextResponse.json({ error: "Provider details are required", details: parsed.error?.flatten() }, { status: 400 })
    }

    const data = parsed.data

    // Create or update provider profile
    const [existing] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!existing) {
      const insertData: NewProvider = {
        userId,
        slug: toSlug(data.businessName, nanoid(6)),
        businessName: data.businessName,
        bio: data.bio,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        serviceRadiusKm: data.serviceRadiusKm,
        ecoLevel: data.ecoLevel,
        isApproved: false,
        isSuspended: false,
      }
      await db.insert(providers).values(insertData)
    }

    const clerk = await clerkClient()
    await clerk.users.updateUser(userId, {
      publicMetadata: { ...(sessionClaims?.metadata as object ?? {}), dualRole: true },
    })
    await db.update(users).set({ dualRoleEnabled: true, updatedAt: new Date() }).where(eq(users.id, userId))

    const res = NextResponse.json({ success: true, redirectTo: "/provider/dashboard" })
    res.cookies.set("dorix_active_role", "provider", {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, path: "/",
    })
    return res
  } catch (err) {
    console.error("[enable-dual-role POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
