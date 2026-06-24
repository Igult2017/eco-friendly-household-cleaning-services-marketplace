import { auth, clerkClient } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, providers, referralCodes, referrals } from "@/lib/db/schema"
import type { NewProvider } from "@/lib/db/schema/providers"
import { eq } from "drizzle-orm"
import { onboardingSchema } from "@/lib/validations/onboarding"
import { nanoid } from "nanoid"
import { inngest } from "@/lib/inngest/client"

const ROLE_COOKIE = "dorix_role"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function toSlug(name: string, suffix: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").substring(0, 40) +
    "-" + suffix
  )
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const parsed = onboardingSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const phone = typeof data.phone === "string" ? data.phone.trim().replace(/[\s\-().]/g, "") : ""
    if (phone && !/^\+?[0-9]{7,15}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
    }

    const clerk = await clerkClient()
    const clerkUser = await clerk.users.getUser(userId)
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""

    await clerk.users.updateUser(userId, { publicMetadata: { role: data.role } })

    // Detect first-time onboarding so the welcome email fires once (the upsert below
    // also covers re-onboarding). The welcome Inngest fn dedupes as a safety net.
    const [pre] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId))
    const isNewUser = !pre

    // Reconcile an account that exists under a DIFFERENT Clerk id for the same verified email
    // (e.g. the dev→prod Clerk instance switch gave returning users new ids, or a user deleted +
    // recreated their Clerk account). The old Clerk id is dead, so free the email by parking the
    // stale row — non-destructive, and it lets the insert below succeed instead of 500-ing on the
    // users_email_idx unique constraint.
    if (isNewUser && email) {
      const [byEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
      if (byEmail && byEmail.id !== userId) {
        await db
          .update(users)
          .set({ email: `migrated.${byEmail.id}@dorixe.invalid`, isActive: false, updatedAt: new Date() })
          .where(eq(users.id, byEmail.id))
      }
    }

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: phone || null,
        role: data.role,
        gdprConsentAt: new Date(),
        avatarUrl: clerkUser.imageUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: phone || null,
          role: data.role,
          gdprConsentAt: new Date(),
          updatedAt: new Date(),
        },
      })

    if (data.role === "provider") {
      const [existing] = await db
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.userId, userId))

      const providerFields = {
        businessName: data.businessName,
        bio: data.bio,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country,
        serviceRadiusKm: data.serviceRadiusKm,
        ecoLevel: data.ecoLevel,
      }

      if (existing) {
        await db.update(providers).set(providerFields).where(eq(providers.userId, userId))
      } else {
        const insertData: NewProvider = {
          userId,
          slug: toSlug(data.businessName, nanoid(6)),
          ...providerFields,
          isApproved: false,
          isSuspended: false,
        }
        await db.insert(providers).values(insertData)
      }
    }

    // Record referral if a valid ref cookie was set before sign-up
    const refCode = req.cookies.get("dorix_ref")?.value
    if (refCode) {
      try {
        const [refCodeRow] = await db
          .select({ userId: referralCodes.userId })
          .from(referralCodes)
          .where(eq(referralCodes.code, refCode))
          .limit(1)

        if (refCodeRow && refCodeRow.userId !== userId) {
          await db.insert(referrals).values({
            referrerId: refCodeRow.userId,
            referredId: userId,
            code: refCode,
            status: "pending",
          }).onConflictDoNothing()
        }
      } catch (refErr) {
        console.warn("[onboarding/complete] referral recording failed:", refErr)
      }
    }

    // First email a client receives: the AI welcome (explains products they may like).
    if (isNewUser) {
      try {
        await inngest.send({ name: "user/welcome", data: { userId } })
      } catch (e) {
        console.warn("[onboarding/complete] welcome email enqueue failed:", e)
      }
    }

    const redirect = data.role === "provider" ? "/provider/dashboard" : "/dashboard"
    const res = NextResponse.json({ success: true, redirect })
    res.cookies.set(ROLE_COOKIE, `${userId}:${data.role}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    })
    res.cookies.delete("dorix_ref")
    return res
  } catch (err) {
    console.error("[onboarding/complete POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
