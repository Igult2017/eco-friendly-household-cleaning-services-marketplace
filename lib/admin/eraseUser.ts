import { db } from "@/lib/db"
import {
  users,
  providers,
  bookings,
  jobPosts,
  reviews,
  customerReviews,
  notifications,
} from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const REDACTED_ADDRESS = { line1: "[erased]", city: "[erased]", postalCode: "[erased]", country: "[erased]" }

async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    console.warn(`[eraseUser] ${label} failed:`, e instanceof Error ? e.message : e)
  }
}

/**
 * GDPR "right to erasure" for a user. Wipes all personal / identifying data while KEEPING the
 * (now-anonymized) financial + audit records that EU tax/accounting law requires us to retain
 * (booking amounts, payments, payouts, review ratings). Best-effort per table — a failure on one
 * table is logged and the rest still run, so the erasure is as complete as possible.
 */
export async function eraseUserData(userId: string): Promise<void> {
  // 1. The user's identity row — frees the email (unique) and removes name/phone/photo.
  await safe("users", () =>
    db.update(users).set({
      email: `deleted-${userId}@dorixe.invalid`,
      firstName: null,
      lastName: null,
      phone: null,
      avatarUrl: null,
      stripeCustomerId: null,
      marketingConsent: false,
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, userId)),
  )

  // 2. Cleaner profile (if any): wipe public identity + address and delist from search/listings.
  await safe("providers", () =>
    db.update(providers).set({
      businessName: "Removed cleaner",
      bio: null,
      profilePhotoUrl: null,
      galleryUrls: [],
      addressLine1: null,
      addressLine2: null,
      latitude: null,
      longitude: null,
      city: null,
      postalCode: null,
      slug: `deleted-${userId}`,
      isApproved: false,
      isSuspended: true,
      updatedAt: new Date(),
    }).where(eq(providers.userId, userId)),
  )

  // 3. Bookings placed as a customer: redact home address + precise location + free-text notes.
  //    Amounts / dates / status are kept (financial record).
  await safe("bookings", () =>
    db.update(bookings).set({
      serviceAddress: REDACTED_ADDRESS,
      serviceLatitude: null,
      serviceLongitude: null,
      specialInstructions: null,
      updatedAt: new Date(),
    }).where(eq(bookings.customerId, userId)),
  )

  // 4. Job posts created by the user: redact address + precise location + free-text description.
  await safe("jobPosts", () =>
    db.update(jobPosts).set({
      serviceAddress: REDACTED_ADDRESS,
      serviceLatitude: 0,
      serviceLongitude: 0,
      description: "[erased]",
      updatedAt: new Date(),
    }).where(eq(jobPosts.customerId, userId)),
  )

  // 5. Review free-text written by the user (keep the rating for provider stats, drop the words).
  await safe("reviews", () =>
    db.update(reviews).set({ title: null, body: null }).where(eq(reviews.customerId, userId)),
  )

  // 6. Reviews written ABOUT the user by cleaners (keep rating, drop free-text).
  await safe("customerReviews", () =>
    db.update(customerReviews).set({ body: null }).where(eq(customerReviews.customerId, userId)),
  )

  // 7. Notifications are transient and may name the user → remove them entirely.
  await safe("notifications", () =>
    db.delete(notifications).where(eq(notifications.userId, userId)),
  )
}
