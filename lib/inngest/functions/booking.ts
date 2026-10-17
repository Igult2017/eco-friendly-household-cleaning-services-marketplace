import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"
import { bookingConfirmedEmail } from "@/lib/resend/transactionalEmails"
import { newBookingForCleanerEmail } from "@/lib/resend/activityEmails"
import { SITE_URL } from "@/lib/seo/site"

export const onBookingCreated = inngest.createFunction(
  { id: "booking-created", triggers: [{ event: "booking/created" }] },
  async ({ event, step }: { event: { data: { bookingId: string; customerId: string; providerId: string } }; step: any }) => {
    const { bookingId, customerId, providerId } = event.data

    const booking = await step.run("fetch-booking", async () => {
      const results = await db.query.bookings.findMany({
        where: (b: any, { eq: eqFn }: any) => eqFn(b.id, bookingId),
        with: { service: { columns: { name: true } } },
        limit: 1,
      })
      return results[0] ?? null
    })

    if (!booking) return { skipped: true }

    const [customer, provider] = await step.run("fetch-parties", async () => {
      const [c] = await db.select({ email: users.email, firstName: users.firstName, locale: users.locale }).from(users).where(eq(users.id, customerId))
      const [p] = await db.select({ businessName: providers.businessName, userId: providers.userId, timezone: providers.timezone }).from(providers).where(eq(providers.id, providerId))
      return [c, p]
    })

    await step.run("notify-provider", async () => {
      if (!provider) return
      const svc = booking.service?.name ?? "a service"
      const dt = new Date(booking.scheduledAt).toLocaleString("en-GB", { timeZone: provider?.timezone || "Europe/Berlin" })
      // If the client asked for recurring work, tell the cleaner so up front (own localized variant).
      const recurring = !!(booking as { requestedFrequency?: string | null }).requestedFrequency
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "booking_confirmed",
        title: recurring ? "New recurring booking!" : "New Booking!",
        body: recurring ? `You have a new recurring booking for ${svc} on ${dt}` : `You have a new booking for ${svc} on ${dt}`,
        // Provider recipient — the customer's /bookings/{id} route 404s for them.
        link: `/provider/bookings`,
        // Base booking_confirmed copy is client-perspective — use the provider variant so the cleaner
        // sees "New booking!" in their language, not "your booking is confirmed".
        metadata: { variant: recurring ? "new_booking_provider_recurring" : "new_booking_provider", service: svc, datetime: dt },
      })

      // The cleaner previously got NOTHING by email when a client booked them directly — only the
      // client was written to. They had to happen to open the app to discover they had work.
      const [pu] = await db
        .select({ email: users.email, locale: users.locale })
        .from(users)
        .where(eq(users.id, provider.userId))
      if (pu?.email) {
        const clientName = [customer?.firstName].filter(Boolean).join(" ") || "A client"
        const { subject, html } = newBookingForCleanerEmail(pu.locale, {
          number: booking.bookingNumber,
          client: clientName,
          scheduled: new Date(booking.scheduledAt).toLocaleString(pu.locale ?? "en-GB", { timeZone: provider?.timezone || "Europe/Berlin" }),
          url: `${SITE_URL}/provider/bookings`,
        })
        await resend.emails.send({ from: FROM, to: pu.email, subject, html })
      }
    })

    await step.run("notify-customer", async () => {
      // Honest wording: at creation the booking is a REQUEST — the cleaner still has to accept it.
      // Saying "confirmed" here read as auto-approval.
      await db.insert(notifications).values({
        userId: customerId,
        type: "booking_confirmed",
        title: "Booking request sent",
        body: "Your booking request was sent to the cleaner. You'll be notified as soon as they accept.",
        link: `/bookings/${bookingId}`,
        metadata: { variant: "booking_request_sent" },
      })
    })

    await step.run("email-customer", async () => {
      if (!customer?.email) return
      const tz = provider?.timezone || "Europe/Berlin"
      const { subject, html } = bookingConfirmedEmail(customer.locale, {
        number: booking.bookingNumber,
        service: booking.service?.name ?? "",
        scheduled: new Date(booking.scheduledAt).toLocaleString(customer.locale ?? "en-GB", { timeZone: tz }),
      })
      await resend.emails.send({ from: FROM, to: customer.email, subject, html })
    })

    return { bookingId, notified: true }
  }
)
