import { auth, clerkClient, currentUser } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { safeLimit, createRateLimiter } from "@/lib/redis/client"

const enableDualRoleRatelimit = createRateLimiter({ tokens: 5, windowSeconds: 600, prefix: "ratelimit:enable-dual-role" })
import { db } from "@/lib/db"
import { users, providers, notifications } from "@/lib/db/schema"
import type { NewProvider } from "@/lib/db/schema/providers"
import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { sendProviderApprovedEmail } from "@/lib/resend/providerApproved"
import { z } from "zod"
import { logError } from "@/lib/utils/logError"

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
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { success: rlOk } = await safeLimit(enableDualRoleRatelimit, userId)
    if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

    // Always fetch live Clerk data — JWT (60s TTL) may have stale role/dualRole,
    // and we need the live publicMetadata as the base when writing back to avoid
    // clobbering fields set by admin (e.g. suspended, stripeCustomerId) since those
    // may have been added after the JWT was issued.
    const liveUser = await currentUser()
    const liveMeta = liveUser?.publicMetadata as { role?: string; dualRole?: boolean } | undefined
    const livePublicMeta = (liveUser?.publicMetadata as object) ?? {}

    const primaryRole = liveMeta?.role ?? "customer"
    const alreadyDual = liveMeta?.dualRole === true

    if (alreadyDual) {
      return NextResponse.json({ error: "Dual role already enabled" }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))

    // Providers enabling dual role (adding customer/posting side) — no new profile needed
    if (primaryRole === "provider") {
      const clerk = await clerkClient()
      await clerk.users.updateUser(userId, {
        publicMetadata: { ...livePublicMeta, dualRole: true },
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
        // Completing this form auto-approves the cleaner (same rule as onboarding).
        isApproved: true,
        isSuspended: false,
      }
      await db.insert(providers).values(insertData)
    } else {
      // BUG-014: a profile already exists (e.g. a prior failed attempt) — apply the
      // submitted details instead of silently keeping the stale row, and approve it.
      await db
        .update(providers)
        .set({
          businessName: data.businessName,
          bio: data.bio,
          city: data.city,
          postalCode: data.postalCode,
          country: data.country,
          serviceRadiusKm: data.serviceRadiusKm,
          ecoLevel: data.ecoLevel,
          isApproved: true,
          updatedAt: new Date(),
        })
        .where(eq(providers.id, existing.id))
    }

    // Auto-approved on form completion — in-app notification + congratulations email (best-effort).
    try {
      await db.insert(notifications).values({
        userId,
        type: "provider_approved",
        title: "You're approved — welcome to DORIXÉ!",
        body: "Your cleaner account is active. You can now browse jobs and place bids.",
        link: "/provider/dashboard",
      })
    } catch (e) { console.warn("[enable-dual-role] approval notification failed:", e) }
    try { await sendProviderApprovedEmail(userId) } catch (e) { console.warn("[enable-dual-role] approval email failed:", e) }

    const clerk = await clerkClient()
    await clerk.users.updateUser(userId, {
      publicMetadata: { ...livePublicMeta, dualRole: true },
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
    void logError({ message: "[enable-dual-role POST]", error: err, route: "/api/users/enable-dual-role", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
