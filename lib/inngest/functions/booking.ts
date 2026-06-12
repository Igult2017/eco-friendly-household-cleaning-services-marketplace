import { inngest } from "../client"
import { db } from "@/lib/db"
import { bookings, users, providers, notifications } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { resend, FROM } from "@/lib/resend/client"

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
      const [c] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, customerId))
      const [p] = await db.select({ businessName: providers.businessName, userId: providers.userId }).from(providers).where(eq(providers.id, providerId))
      return [c, p]
    })

    await step.run("notify-provider", async () => {
      if (!provider) return
      await db.insert(notifications).values({
        userId: provider.userId,
        type: "booking_confirmed",
        title: "New Booking!",
        body: `You have a new booking for ${booking.service?.name ?? "a service"} on ${new Date(booking.scheduledAt).toLocaleDateString("en-GB")}`,
        link: `/bookings/${bookingId}`,
      })
    })

    await step.run("email-customer", async () => {
      if (!customer?.email) return
      await resend.emails.send({
        from: FROM,
        to: customer.email,
        subject: `Booking Confirmed — ${booking.bookingNumber}`,
        html: `
          <h2>Your booking is confirmed!</h2>
          <p>Booking number: <strong>${booking.bookingNumber}</strong></p>
          <p>Service: ${booking.service?.name}</p>
          <p>Scheduled: ${new Date(booking.scheduledAt).toLocaleString("en-GB")}</p>
          <p>Your card has been pre-authorised. You will only be charged once the cleaning is completed.</p>
          <p>Thank you for choosing DORIXÉ 🌿</p>
        `,
      })
    })

    return { bookingId, notified: true }
  }
)
