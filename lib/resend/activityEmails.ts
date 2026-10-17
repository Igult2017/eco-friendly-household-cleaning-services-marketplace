import { defaultLocale } from "@/i18n/config"
import { loc, esc, sub, shell, H1S, PS, BTNS, THX } from "./emailShell"

// Emails for the moments that matter to people but previously only raised an in-app notification
// nobody was watching for. The biggest gap these close: a cleaner booked directly by a client was
// told NOTHING by email — only the client was written to.
//
// Separate from transactionalEmails.ts purely for length; both share the same branded shell.

type Row = { subject: string; heading: string; body: string; button: string; thanks: string }
type Tx = {
  newBookingForCleaner: Row   // a client booked you directly
  bookingCancelled: Row       // the other side cancelled or declined
  confirmCompletion: Row      // the cleaner says it's done — client, please confirm
  cleanerPaid: Row            // money has actually been sent to the cleaner
  startingSoon: Row           // the appointment starts in a few hours
  deadlineSoon: Row           // the cleaner's finish-by time is approaching
}

const TX: Record<string, Tx> = {
  en: {
    newBookingForCleaner: { subject: "New booking — {number}", heading: "You have a new booking", body: "{client} booked you for {scheduled}. Accept it in your dashboard so they know you're coming.", button: "View the booking", thanks: "Thank you for cleaning with DORIXÉ 🌿" },
    bookingCancelled: { subject: "Booking cancelled — {number}", heading: "A booking was cancelled", body: "The booking scheduled for {scheduled} has been cancelled. {detail}", button: "View details", thanks: "Thank you for choosing DORIXÉ 🌿" },
    confirmCompletion: { subject: "Your cleaning is done — please confirm", heading: "Your cleaner has finished", body: "{cleaner} marked the cleaning on {scheduled} as complete. Please confirm so they can be paid. If something isn't right, open a dispute instead.", button: "Confirm the work", thanks: "Thank you for choosing DORIXÉ 🌿" },
    cleanerPaid: { subject: "You've been paid — {amount}", heading: "Payment on its way", body: "{amount} for the cleaning on {scheduled} has been released to your payout account. Your bank receives it on your usual payout schedule.", button: "View your earnings", thanks: "Thank you for cleaning with DORIXÉ 🌿" },
    startingSoon: { subject: "Starting in {hours} hours — {number}", heading: "Your cleaning starts soon", body: "The cleaning at {address} is due to start at {scheduled}, about {hours} hours from now.", button: "View the booking", thanks: "Thank you for choosing DORIXÉ 🌿" },
    deadlineSoon: { subject: "Due to finish in {hours} hours — {number}", heading: "Your job is due to finish soon", body: "The cleaning at {address} is due to be finished by {deadline}, about {hours} hours from now. Mark it complete once you're done so you can be paid.", button: "Mark it complete", thanks: "Thank you for cleaning with DORIXÉ 🌿" },
  },
  de: {
    newBookingForCleaner: { subject: "Neue Buchung — {number}", heading: "Sie haben eine neue Buchung", body: "{client} hat Sie für {scheduled} gebucht. Nehmen Sie die Buchung im Dashboard an, damit die Person weiß, dass Sie kommen.", button: "Buchung ansehen", thanks: "Danke, dass Sie mit DORIXÉ reinigen 🌿" },
    bookingCancelled: { subject: "Buchung storniert — {number}", heading: "Eine Buchung wurde storniert", body: "Die Buchung für {scheduled} wurde storniert. {detail}", button: "Details ansehen", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
    confirmCompletion: { subject: "Ihre Reinigung ist fertig — bitte bestätigen", heading: "Ihre Reinigungskraft ist fertig", body: "{cleaner} hat die Reinigung am {scheduled} als erledigt markiert. Bitte bestätigen Sie, damit die Bezahlung erfolgen kann. Stimmt etwas nicht, eröffnen Sie stattdessen einen Streitfall.", button: "Arbeit bestätigen", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
    cleanerPaid: { subject: "Sie wurden bezahlt — {amount}", heading: "Zahlung ist unterwegs", body: "{amount} für die Reinigung am {scheduled} wurden für Ihre Auszahlung freigegeben. Ihre Bank erhält den Betrag gemäß Ihrem üblichen Auszahlungsrhythmus.", button: "Einnahmen ansehen", thanks: "Danke, dass Sie mit DORIXÉ reinigen 🌿" },
    startingSoon: { subject: "Beginnt in {hours} Stunden — {number}", heading: "Ihre Reinigung beginnt bald", body: "Die Reinigung in {address} beginnt um {scheduled}, in etwa {hours} Stunden.", button: "Buchung ansehen", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
    deadlineSoon: { subject: "Fertigstellung in {hours} Stunden — {number}", heading: "Ihr Auftrag sollte bald fertig sein", body: "Die Reinigung in {address} sollte bis {deadline} abgeschlossen sein, in etwa {hours} Stunden. Markieren Sie sie als erledigt, sobald Sie fertig sind, damit Sie bezahlt werden.", button: "Als erledigt markieren", thanks: "Danke, dass Sie mit DORIXÉ reinigen 🌿" },
  },
  fr: {
    newBookingForCleaner: { subject: "Nouvelle réservation — {number}", heading: "Vous avez une nouvelle réservation", body: "{client} vous a réservé pour {scheduled}. Acceptez-la depuis votre tableau de bord pour confirmer votre venue.", button: "Voir la réservation", thanks: "Merci de nettoyer avec DORIXÉ 🌿" },
    bookingCancelled: { subject: "Réservation annulée — {number}", heading: "Une réservation a été annulée", body: "La réservation prévue le {scheduled} a été annulée. {detail}", button: "Voir les détails", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
    confirmCompletion: { subject: "Votre ménage est terminé — merci de confirmer", heading: "Votre intervenant a terminé", body: "{cleaner} a indiqué que le ménage du {scheduled} est terminé. Merci de confirmer pour qu'il puisse être payé. Si quelque chose ne va pas, ouvrez plutôt un litige.", button: "Confirmer le travail", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
    cleanerPaid: { subject: "Vous avez été payé — {amount}", heading: "Paiement en route", body: "{amount} pour le ménage du {scheduled} ont été débloqués vers votre compte de paiement. Votre banque les recevra selon votre rythme de versement habituel.", button: "Voir mes revenus", thanks: "Merci de nettoyer avec DORIXÉ 🌿" },
    startingSoon: { subject: "Début dans {hours} heures — {number}", heading: "Votre ménage commence bientôt", body: "Le ménage au {address} doit commencer à {scheduled}, dans environ {hours} heures.", button: "Voir la réservation", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
    deadlineSoon: { subject: "À terminer dans {hours} heures — {number}", heading: "Votre mission doit bientôt se terminer", body: "Le ménage au {address} doit être terminé pour {deadline}, dans environ {hours} heures. Marquez-le comme terminé une fois fini pour être payé.", button: "Marquer comme terminé", thanks: "Merci de nettoyer avec DORIXÉ 🌿" },
  },
  es: {
    newBookingForCleaner: { subject: "Nueva reserva — {number}", heading: "Tienes una nueva reserva", body: "{client} te ha reservado para {scheduled}. Acéptala en tu panel para que sepa que vas a ir.", button: "Ver la reserva", thanks: "Gracias por limpiar con DORIXÉ 🌿" },
    bookingCancelled: { subject: "Reserva cancelada — {number}", heading: "Se ha cancelado una reserva", body: "La reserva prevista para {scheduled} ha sido cancelada. {detail}", button: "Ver detalles", thanks: "Gracias por elegir DORIXÉ 🌿" },
    confirmCompletion: { subject: "Tu limpieza está hecha: confírmalo", heading: "Tu profesional ha terminado", body: "{cleaner} ha marcado como completada la limpieza del {scheduled}. Confírmalo para que pueda cobrar. Si algo no está bien, abre una disputa.", button: "Confirmar el trabajo", thanks: "Gracias por elegir DORIXÉ 🌿" },
    cleanerPaid: { subject: "Te han pagado: {amount}", heading: "Pago en camino", body: "{amount} por la limpieza del {scheduled} se han liberado a tu cuenta de cobros. Tu banco lo recibirá según tu calendario habitual.", button: "Ver mis ingresos", thanks: "Gracias por limpiar con DORIXÉ 🌿" },
    startingSoon: { subject: "Empieza en {hours} horas — {number}", heading: "Tu limpieza empieza pronto", body: "La limpieza en {address} empieza a las {scheduled}, dentro de unas {hours} horas.", button: "Ver la reserva", thanks: "Gracias por elegir DORIXÉ 🌿" },
    deadlineSoon: { subject: "Debe terminar en {hours} horas — {number}", heading: "Tu trabajo debe terminar pronto", body: "La limpieza en {address} debe estar terminada antes de las {deadline}, dentro de unas {hours} horas. Márcala como completada al acabar para poder cobrar.", button: "Marcar como completada", thanks: "Gracias por limpiar con DORIXÉ 🌿" },
  },
  it: {
    newBookingForCleaner: { subject: "Nuova prenotazione — {number}", heading: "Hai una nuova prenotazione", body: "{client} ti ha prenotato per {scheduled}. Accettala dalla tua dashboard così sa che arriverai.", button: "Vedi la prenotazione", thanks: "Grazie per pulire con DORIXÉ 🌿" },
    bookingCancelled: { subject: "Prenotazione annullata — {number}", heading: "Una prenotazione è stata annullata", body: "La prenotazione prevista per {scheduled} è stata annullata. {detail}", button: "Vedi i dettagli", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
    confirmCompletion: { subject: "La pulizia è finita: conferma", heading: "Il tuo addetto ha finito", body: "{cleaner} ha segnato come completata la pulizia del {scheduled}. Conferma così può essere pagato. Se qualcosa non va, apri invece una contestazione.", button: "Conferma il lavoro", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
    cleanerPaid: { subject: "Sei stato pagato: {amount}", heading: "Pagamento in arrivo", body: "{amount} per la pulizia del {scheduled} sono stati sbloccati sul tuo conto di pagamento. La banca li riceverà secondo il tuo solito calendario.", button: "Vedi i guadagni", thanks: "Grazie per pulire con DORIXÉ 🌿" },
    startingSoon: { subject: "Inizia tra {hours} ore — {number}", heading: "La pulizia inizia a breve", body: "La pulizia in {address} inizia alle {scheduled}, tra circa {hours} ore.", button: "Vedi la prenotazione", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
    deadlineSoon: { subject: "Da finire tra {hours} ore — {number}", heading: "Il lavoro deve finire a breve", body: "La pulizia in {address} deve essere completata entro le {deadline}, tra circa {hours} ore. Segnala come completata quando hai finito per essere pagato.", button: "Segna come completata", thanks: "Grazie per pulire con DORIXÉ 🌿" },
  },
  nl: {
    newBookingForCleaner: { subject: "Nieuwe boeking — {number}", heading: "Je hebt een nieuwe boeking", body: "{client} heeft je geboekt voor {scheduled}. Accepteer de boeking in je dashboard zodat ze weten dat je komt.", button: "Bekijk de boeking", thanks: "Bedankt dat je schoonmaakt met DORIXÉ 🌿" },
    bookingCancelled: { subject: "Boeking geannuleerd — {number}", heading: "Een boeking is geannuleerd", body: "De boeking voor {scheduled} is geannuleerd. {detail}", button: "Bekijk details", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
    confirmCompletion: { subject: "Je schoonmaak is klaar — bevestig even", heading: "Je schoonmaker is klaar", body: "{cleaner} heeft de schoonmaak van {scheduled} als afgerond gemarkeerd. Bevestig dit zodat die betaald kan worden. Klopt er iets niet, open dan een geschil.", button: "Werk bevestigen", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
    cleanerPaid: { subject: "Je bent betaald — {amount}", heading: "Betaling onderweg", body: "{amount} voor de schoonmaak van {scheduled} is vrijgegeven naar je uitbetaalrekening. Je bank ontvangt het volgens je gebruikelijke schema.", button: "Bekijk je verdiensten", thanks: "Bedankt dat je schoonmaakt met DORIXÉ 🌿" },
    startingSoon: { subject: "Begint over {hours} uur — {number}", heading: "Je schoonmaak begint binnenkort", body: "De schoonmaak op {address} begint om {scheduled}, over ongeveer {hours} uur.", button: "Bekijk de boeking", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
    deadlineSoon: { subject: "Klaar over {hours} uur — {number}", heading: "Je klus moet binnenkort klaar zijn", body: "De schoonmaak op {address} moet klaar zijn om {deadline}, over ongeveer {hours} uur. Markeer hem als afgerond zodra je klaar bent zodat je betaald wordt.", button: "Markeer als afgerond", thanks: "Bedankt dat je schoonmaakt met DORIXÉ 🌿" },
  },
  pl: {
    newBookingForCleaner: { subject: "Nowa rezerwacja — {number}", heading: "Masz nową rezerwację", body: "{client} zarezerwował(a) Cię na {scheduled}. Zaakceptuj ją w panelu, aby wiedzieli, że przyjedziesz.", button: "Zobacz rezerwację", thanks: "Dziękujemy, że sprzątasz z DORIXÉ 🌿" },
    bookingCancelled: { subject: "Rezerwacja anulowana — {number}", heading: "Rezerwacja została anulowana", body: "Rezerwacja na {scheduled} została anulowana. {detail}", button: "Zobacz szczegóły", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
    confirmCompletion: { subject: "Sprzątanie zakończone — potwierdź", heading: "Osoba sprzątająca skończyła", body: "{cleaner} oznaczył(a) sprzątanie z {scheduled} jako zakończone. Potwierdź, aby mogła otrzymać zapłatę. Jeśli coś jest nie tak, zgłoś spór.", button: "Potwierdź wykonanie", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
    cleanerPaid: { subject: "Otrzymałeś zapłatę — {amount}", heading: "Płatność w drodze", body: "{amount} za sprzątanie z {scheduled} zostało zwolnione na Twoje konto wypłat. Bank otrzyma je zgodnie ze zwykłym harmonogramem.", button: "Zobacz zarobki", thanks: "Dziękujemy, że sprzątasz z DORIXÉ 🌿" },
    startingSoon: { subject: "Start za {hours} godz. — {number}", heading: "Sprzątanie wkrótce się zacznie", body: "Sprzątanie pod adresem {address} zaczyna się o {scheduled}, za około {hours} godz.", button: "Zobacz rezerwację", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
    deadlineSoon: { subject: "Zakończenie za {hours} godz. — {number}", heading: "Zlecenie wkrótce powinno się zakończyć", body: "Sprzątanie pod adresem {address} powinno zakończyć się do {deadline}, za około {hours} godz. Oznacz je jako wykonane, aby otrzymać zapłatę.", button: "Oznacz jako wykonane", thanks: "Dziękujemy, że sprzątasz z DORIXÉ 🌿" },
  },
  pt: {
    newBookingForCleaner: { subject: "Nova reserva — {number}", heading: "Tem uma nova reserva", body: "{client} reservou-o para {scheduled}. Aceite no seu painel para que saibam que vai aparecer.", button: "Ver a reserva", thanks: "Obrigado por limpar com a DORIXÉ 🌿" },
    bookingCancelled: { subject: "Reserva cancelada — {number}", heading: "Uma reserva foi cancelada", body: "A reserva agendada para {scheduled} foi cancelada. {detail}", button: "Ver detalhes", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
    confirmCompletion: { subject: "A sua limpeza está feita — confirme", heading: "O seu profissional terminou", body: "{cleaner} marcou a limpeza de {scheduled} como concluída. Confirme para que possa ser pago. Se algo não estiver bem, abra antes uma disputa.", button: "Confirmar o trabalho", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
    cleanerPaid: { subject: "Foi pago — {amount}", heading: "Pagamento a caminho", body: "{amount} pela limpeza de {scheduled} foram libertados para a sua conta de pagamentos. O seu banco recebe-o no calendário habitual.", button: "Ver os meus ganhos", thanks: "Obrigado por limpar com a DORIXÉ 🌿" },
    startingSoon: { subject: "Começa em {hours} horas — {number}", heading: "A sua limpeza começa em breve", body: "A limpeza em {address} começa às {scheduled}, daqui a cerca de {hours} horas.", button: "Ver a reserva", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
    deadlineSoon: { subject: "Termina em {hours} horas — {number}", heading: "O seu trabalho deve terminar em breve", body: "A limpeza em {address} deve estar concluída até às {deadline}, daqui a cerca de {hours} horas. Marque como concluída quando terminar para poder ser pago.", button: "Marcar como concluída", thanks: "Obrigado por limpar com a DORIXÉ 🌿" },
  },
}

type Built = { subject: string; html: string }

/** Shared renderer — every template here has the same shape, so there is one builder, not six. */
function build(locale: string | null | undefined, key: keyof Tx, vars: Record<string, string>, url: string): Built {
  const t = (TX[loc(locale)] ?? TX[defaultLocale])[key]
  const safe = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]))
  const inner = `<h1 style="${H1S}">${sub(t.heading, safe)}</h1>
    <p style="${PS}">${sub(t.body, safe)}</p>
    <a href="${url}" style="${BTNS}">${t.button}</a>
    <p style="${THX}">${t.thanks}</p>`
  return { subject: sub(t.subject, safe), html: shell(inner) }
}

export const newBookingForCleanerEmail = (l: string | null | undefined, v: { number: string; client: string; scheduled: string; url: string }) =>
  build(l, "newBookingForCleaner", { number: v.number, client: v.client, scheduled: v.scheduled }, v.url)

export const bookingCancelledEmail = (l: string | null | undefined, v: { number: string; scheduled: string; detail: string; url: string }) =>
  build(l, "bookingCancelled", { number: v.number, scheduled: v.scheduled, detail: v.detail }, v.url)

export const confirmCompletionEmail = (l: string | null | undefined, v: { cleaner: string; scheduled: string; url: string }) =>
  build(l, "confirmCompletion", { cleaner: v.cleaner, scheduled: v.scheduled }, v.url)

export const cleanerPaidEmail = (l: string | null | undefined, v: { amount: string; scheduled: string; url: string }) =>
  build(l, "cleanerPaid", { amount: v.amount, scheduled: v.scheduled }, v.url)

export const startingSoonEmail = (l: string | null | undefined, v: { number: string; address: string; scheduled: string; hours: number; url: string }) =>
  build(l, "startingSoon", { number: v.number, address: v.address, scheduled: v.scheduled, hours: String(v.hours) }, v.url)

export const deadlineSoonEmail = (l: string | null | undefined, v: { number: string; address: string; deadline: string; hours: number; url: string }) =>
  build(l, "deadlineSoon", { number: v.number, address: v.address, deadline: v.deadline, hours: String(v.hours) }, v.url)
