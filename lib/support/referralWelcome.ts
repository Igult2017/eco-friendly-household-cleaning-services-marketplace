import { db } from "@/lib/db"
import { supportMessages, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// Sent once per user, right after the welcome message — explains the referral programme in the
// support channel. Uses its own sender marker ("system-referral") rather than the approval-welcome
// check ("is the thread empty") so it never collides with sendApprovalSupportWelcome, which can
// fire independently (and at a different time) for cleaners.
const CLEANER: Record<string, string> = {
  en: "💰 Your referral link is live! Invite other cleaners and earn a commission on their first 3 completed jobs — invite clients and earn a commission on every booking they make. Commissions are credited to your balance automatically and paid out to your bank via Stripe at the start of each month, no action needed. Find your link on your dashboard.",
  de: "💰 Dein Empfehlungslink ist aktiv! Empfiehl andere Reinigungskräfte und erhalte eine Provision für ihre ersten 3 abgeschlossenen Aufträge — empfiehl Kund:innen und erhalte eine Provision auf jede ihrer Buchungen. Provisionen werden automatisch deinem Guthaben gutgeschrieben und zu Monatsbeginn per Stripe auf dein Bankkonto ausgezahlt, ganz ohne dein Zutun. Deinen Link findest du in deinem Dashboard.",
  fr: "💰 Votre lien de parrainage est actif ! Parrainez d'autres intervenants et gagnez une commission sur leurs 3 premières missions terminées — parrainez des clients et gagnez une commission sur chacune de leurs réservations. Les commissions sont créditées automatiquement sur votre solde et versées sur votre compte bancaire via Stripe en début de mois, sans aucune démarche de votre part. Retrouvez votre lien sur votre tableau de bord.",
  es: "💰 ¡Tu enlace de referidos ya está activo! Invita a otros profesionales de limpieza y gana una comisión por sus primeros 3 trabajos completados — invita a clientes y gana una comisión por cada reserva que hagan. Las comisiones se acreditan automáticamente en tu saldo y se transfieren a tu banco por Stripe a principios de cada mes, sin que tengas que hacer nada. Encuentra tu enlace en tu panel.",
  it: "💰 Il tuo link referral è attivo! Invita altri addetti alle pulizie e guadagna una commissione sui loro primi 3 lavori completati — invita clienti e guadagna una commissione su ogni loro prenotazione. Le commissioni vengono accreditate automaticamente sul tuo saldo e trasferite sul tuo conto bancario tramite Stripe all'inizio di ogni mese, senza bisogno di fare nulla. Trovi il tuo link nella tua dashboard.",
  nl: "💰 Je verwijzingslink is actief! Verwijs andere schoonmakers en verdien commissie op hun eerste 3 voltooide klussen — verwijs klanten en verdien commissie op elke boeking die ze maken. Commissies worden automatisch bijgeschreven op je saldo en aan het begin van elke maand via Stripe naar je bank overgemaakt, zonder dat je iets hoeft te doen. Je vindt je link op je dashboard.",
  pl: "💰 Twój link polecający jest aktywny! Polecaj innym osobom sprzątającym i zarabiaj prowizję od ich pierwszych 3 ukończonych zleceń — polecaj klientów i zarabiaj prowizję od każdej ich rezerwacji. Prowizje są automatycznie naliczane na Twoje saldo i wypłacane na konto bankowe przez Stripe na początku każdego miesiąca, bez żadnych działań z Twojej strony. Swój link znajdziesz w panelu.",
  pt: "💰 O teu link de indicação já está ativo! Indica outros profissionais de limpeza e ganha uma comissão nos seus primeiros 3 trabalhos concluídos — indica clientes e ganha uma comissão em cada reserva que fizerem. As comissões são creditadas automaticamente no teu saldo e transferidas para o teu banco via Stripe no início de cada mês, sem precisares de fazer nada. Encontras o teu link no teu painel.",
}

const CLIENT: Record<string, string> = {
  en: "🎁 Your referral link is live! Invite friends or cleaners and earn a discount credited to your account for every order they complete. Use it as a discount on your next booking, or withdraw it to your bank any time. Find your link on your dashboard.",
  de: "🎁 Dein Empfehlungslink ist aktiv! Empfiehl Freund:innen oder Reinigungskräfte und erhalte für jede abgeschlossene Bestellung einen Rabatt, der deinem Konto gutgeschrieben wird. Nutze ihn als Rabatt bei deiner nächsten Buchung oder lass ihn dir jederzeit auf dein Bankkonto auszahlen. Deinen Link findest du in deinem Dashboard.",
  fr: "🎁 Votre lien de parrainage est actif ! Parrainez des amis ou des intervenants et gagnez une réduction créditée sur votre compte pour chaque commande terminée. Utilisez-la comme réduction lors de votre prochaine réservation, ou retirez-la vers votre banque à tout moment. Retrouvez votre lien sur votre tableau de bord.",
  es: "🎁 ¡Tu enlace de referidos ya está activo! Invita a amigos o profesionales de limpieza y gana un descuento acreditado en tu cuenta por cada pedido que completen. Úsalo como descuento en tu próxima reserva, o retíralo a tu banco cuando quieras. Encuentra tu enlace en tu panel.",
  it: "🎁 Il tuo link referral è attivo! Invita amici o addetti alle pulizie e guadagna uno sconto accreditato sul tuo account per ogni ordine completato. Usalo come sconto sulla tua prossima prenotazione, oppure prelevalo sul tuo conto bancario quando vuoi. Trovi il tuo link nella tua dashboard.",
  nl: "🎁 Je verwijzingslink is actief! Verwijs vrienden of schoonmakers en verdien voor elke voltooide bestelling een korting die op je account wordt bijgeschreven. Gebruik het als korting bij je volgende boeking, of neem het op naar je bank wanneer je wilt. Je vindt je link op je dashboard.",
  pl: "🎁 Twój link polecający jest aktywny! Polecaj znajomych lub osoby sprzątające i zdobywaj zniżkę zaliczaną na Twoje konto za każde ukończone zamówienie. Wykorzystaj ją jako zniżkę przy następnej rezerwacji lub wypłać na konto bankowe w dowolnym momencie. Swój link znajdziesz w panelu.",
  pt: "🎁 O teu link de indicação já está ativo! Indica amigos ou profissionais de limpeza e ganha um desconto creditado na tua conta por cada encomenda concluída. Usa-o como desconto na tua próxima reserva, ou levanta-o para o teu banco quando quiseres. Encontras o teu link no teu painel.",
}

export async function sendReferralExplainerSupportMessage(userId: string): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: supportMessages.id })
      .from(supportMessages)
      .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderId, "system-referral")))
      .limit(1)
    if (existing) return
    const [u] = await db.select({ locale: users.locale, role: users.role }).from(users).where(eq(users.id, userId))
    const table = u?.role === "provider" ? CLEANER : CLIENT
    const body = table[u?.locale ?? "en"] ?? table.en
    await db.insert(supportMessages).values({ userId, senderId: "system-referral", fromAdmin: true, body })
  } catch (e) {
    console.warn("[support] referral explainer message failed:", e)
  }
}
