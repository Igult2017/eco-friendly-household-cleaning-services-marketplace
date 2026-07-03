import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bookings, providers, users, messages, notifications } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { pusherServer } from "@/lib/pusher/server"
import { isUuid } from "@/lib/utils/uuid"
import { logError } from "@/lib/utils/logError"

// Cleaner "accepts pending payment": tells the client the booking is accepted but the contract
// only takes effect once a payment method is added. Sends a chat message (in the CLIENT's
// language) + a notification linking straight to the add-payment page.
const CHAT: Record<string, string> = {
  en: "I've accepted your booking. Please add a payment method to make it official — the contract only takes effect once it's added, and nothing is charged before the work is completed and confirmed.",
  de: "Ich habe deine Buchung angenommen. Bitte füge eine Zahlungsmethode hinzu, um sie verbindlich zu machen — der Vertrag gilt erst, wenn sie hinterlegt ist, und abgebucht wird erst nach Abschluss und Bestätigung der Arbeit.",
  fr: "J'ai accepté votre réservation. Veuillez ajouter un moyen de paiement pour la rendre effective — le contrat ne prend effet qu'une fois celui-ci ajouté, et rien n'est débité avant la fin et la confirmation du travail.",
  es: "He aceptado tu reserva. Añade un método de pago para hacerla efectiva: el contrato solo entra en vigor cuando lo añadas, y no se cobra nada antes de completar y confirmar el trabajo.",
  it: "Ho accettato la tua prenotazione. Aggiungi un metodo di pagamento per renderla effettiva — il contratto ha effetto solo dopo l'aggiunta, e nulla viene addebitato prima del completamento e della conferma del lavoro.",
  nl: "Ik heb je boeking geaccepteerd. Voeg een betaalmethode toe om het definitief te maken — het contract gaat pas in zodra die is toegevoegd, en er wordt niets afgeschreven voordat het werk is afgerond en bevestigd.",
  pl: "Przyjąłem/przyjęłam Twoją rezerwację. Dodaj metodę płatności, aby stała się wiążąca — umowa wchodzi w życie dopiero po jej dodaniu, a opłata pobierana jest dopiero po zakończeniu i potwierdzeniu pracy.",
  pt: "Aceitei a tua reserva. Adiciona um método de pagamento para a tornar efetiva — o contrato só entra em vigor depois de o adicionares, e nada é cobrado antes de o trabalho estar concluído e confirmado.",
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: "Invalid booking id" }, { status: 400 })

    const [provider] = await db.select({ id: providers.id }).from(providers).where(eq(providers.userId, userId))
    if (!provider) return NextResponse.json({ error: "Cleaners only" }, { status: 403 })

    const [b] = await db
      .select({ id: bookings.id, customerId: bookings.customerId, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.providerId, provider.id)))
    if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    if (b.status !== "pending_payment") {
      return NextResponse.json({ error: "This booking already has a payment method." }, { status: 422 })
    }

    const [client] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, b.customerId))
    const chatBody = CHAT[client?.locale ?? "en"] ?? CHAT.en

    const [msg] = await db.insert(messages).values({ bookingId: id, senderId: userId, body: chatBody }).returning()
    try {
      await pusherServer.trigger(`private-booking-${id}`, "new-message", {
        messageId: msg.id, senderId: userId, body: chatBody, createdAt: msg.createdAt,
      })
    } catch { /* realtime is best-effort — the message is stored */ }

    await db.insert(notifications).values({
      userId: b.customerId,
      type: "booking_reminder",
      title: "Cleaner accepted — add a payment method to seal it",
      body: "Your cleaner has accepted your booking, pending a payment method. The contract only takes effect once you add one — nothing is charged before the work is completed and confirmed.",
      link: `/bookings/${id}/pay`,
      metadata: { variant: "booking_accepted_pending_payment" },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[bookings/[id]/request-payment POST]", err)
    void logError({ message: "[bookings/[id]/request-payment POST]", error: err, route: "/api/bookings/[id]/request-payment", severity: "error" })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
