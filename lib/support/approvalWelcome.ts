import { db } from "@/lib/db"
import { supportMessages, users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// The approval notification links to the support channel — so "you're approved" must be an
// OPENABLE conversation there, not a dead toast. Written in the cleaner's own language (stored
// text — support messages aren't render-time localized). Only posted while the user's support
// thread is still empty, so re-approvals and repeat events never duplicate it.
const WELCOME: Record<string, string> = {
  en: "🎉 Welcome to DORIXÉ! Your cleaner account is approved and active — you can browse jobs and place bids right away. This thread is your direct line to the DORIXÉ team: if you need help with your profile, jobs, payouts or anything else, just reply here.",
  de: "🎉 Willkommen bei DORIXÉ! Dein Reinigungskraft-Konto ist freigegeben und aktiv — du kannst sofort Aufträge durchsuchen und Angebote abgeben. Dieser Chat ist dein direkter Draht zum DORIXÉ-Team: Wenn du Hilfe mit Profil, Aufträgen, Auszahlungen oder etwas anderem brauchst, antworte einfach hier.",
  fr: "🎉 Bienvenue chez DORIXÉ ! Votre compte intervenant est approuvé et actif — vous pouvez dès maintenant parcourir les missions et proposer vos offres. Ce fil est votre ligne directe avec l'équipe DORIXÉ : pour toute aide (profil, missions, versements ou autre), répondez simplement ici.",
  es: "🎉 ¡Bienvenido a DORIXÉ! Tu cuenta de profesional está aprobada y activa: ya puedes explorar trabajos y enviar ofertas. Este hilo es tu línea directa con el equipo de DORIXÉ: si necesitas ayuda con tu perfil, trabajos, cobros o cualquier otra cosa, responde aquí.",
  it: "🎉 Benvenuto su DORIXÉ! Il tuo account addetto è approvato e attivo — puoi già sfogliare i lavori e fare offerte. Questa chat è la tua linea diretta con il team DORIXÉ: se ti serve aiuto con profilo, lavori, pagamenti o altro, rispondi pure qui.",
  nl: "🎉 Welkom bij DORIXÉ! Je schoonmakersaccount is goedgekeurd en actief — je kunt direct klussen bekijken en biedingen plaatsen. Deze chat is je directe lijn met het DORIXÉ-team: heb je hulp nodig met je profiel, klussen, uitbetalingen of iets anders, reageer dan gewoon hier.",
  pl: "🎉 Witamy w DORIXÉ! Twoje konto osoby sprzątającej zostało zatwierdzone i jest aktywne — możesz od razu przeglądać zlecenia i składać oferty. Ten wątek to Twoja bezpośrednia linia do zespołu DORIXÉ: jeśli potrzebujesz pomocy z profilem, zleceniami, wypłatami lub czymkolwiek innym, po prostu odpisz tutaj.",
  pt: "🎉 Bem-vindo à DORIXÉ! A tua conta de profissional está aprovada e ativa — já podes explorar trabalhos e enviar propostas. Esta conversa é a tua linha direta com a equipa DORIXÉ: se precisares de ajuda com o perfil, trabalhos, pagamentos ou outra coisa, responde aqui.",
}

export async function sendApprovalSupportWelcome(userId: string): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: supportMessages.id })
      .from(supportMessages)
      .where(eq(supportMessages.userId, userId))
      .limit(1)
    if (existing) return
    const [u] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId))
    const body = WELCOME[u?.locale ?? "en"] ?? WELCOME.en
    await db.insert(supportMessages).values({ userId, senderId: "system", fromAdmin: true, body })
  } catch (e) {
    console.warn("[support] approval welcome message failed:", e)
  }
}
