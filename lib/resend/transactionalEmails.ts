import { isLocale, defaultLocale } from "@/i18n/config"

// Localized transactional emails (booking lifecycle + weekly payout). Each builder takes the
// RECIPIENT's locale (stored on users.locale at onboarding) + the dynamic values, and returns
// { subject, html }. Sent directly via Resend (transactional), so each returns the full branded
// HTML. Dynamic dates/amounts are pre-formatted by the caller (locale-aware). Falls back to English.

type Tx = {
  bookingConfirmed: { subject: string; heading: string; labelNumber: string; labelService: string; labelScheduled: string; preauth: string; thanks: string }
  reviewRequest: { subject: string; heading: string; greeting: string; body: string; button: string; thanks: string }
  reviewReminder: { subject: string; body: string; link: string }
  weeklyEarnings: { subject: string; heading: string; greeting: string; earned: string; period: string; explainer: string; thanks: string }
  reminderTomorrow: { subject: string; heading: string; greeting: string; body: string; addressLabel: string; thanks: string }
}

const TX: Record<string, Tx> = {
  en: {
    bookingConfirmed: { subject: "Booking confirmed — {number}", heading: "Your booking is confirmed!", labelNumber: "Booking number:", labelService: "Service:", labelScheduled: "Scheduled:", preauth: "Your card has been pre-authorised. You'll only be charged once the cleaning is completed.", thanks: "Thank you for choosing DORIXÉ 🌿" },
    reviewRequest: { subject: "How was your cleaning? Leave a review 🌿", heading: "Your home is sparkling clean!", greeting: "Hi {name},", body: "Your cleaning session has been completed and payment captured.", button: "Leave a review", thanks: "Thank you for choosing DORIXÉ 🌿" },
    reviewReminder: { subject: "Reminder: share your DORIXÉ experience", body: "Just a friendly reminder to leave a review for your recent cleaning.", link: "Leave a review" },
    weeklyEarnings: { subject: "Your weekly earnings summary: {amount}", heading: "Your earnings this week", greeting: "Hi {name},", earned: "You earned {amount} across {count} booking(s).", period: "Period: {start} to {end}", explainer: "These funds are paid directly into your connected Stripe account as each job completes, and Stripe pays out to your bank on your account's payout schedule.", thanks: "Thank you for being part of DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Reminder: your cleaning is tomorrow 🌿", heading: "Your cleaning is tomorrow!", greeting: "Hi {name},", body: "Just a reminder that your cleaning session is scheduled for {time}.", addressLabel: "Address:", thanks: "Thank you for choosing DORIXÉ 🌿" },
  },
  de: {
    bookingConfirmed: { subject: "Buchung bestätigt — {number}", heading: "Ihre Buchung ist bestätigt!", labelNumber: "Buchungsnummer:", labelService: "Leistung:", labelScheduled: "Termin:", preauth: "Ihre Karte wurde vorautorisiert. Die Abbuchung erfolgt erst, wenn die Reinigung abgeschlossen ist.", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
    reviewRequest: { subject: "Wie war Ihre Reinigung? Hinterlassen Sie eine Bewertung 🌿", heading: "Ihr Zuhause strahlt vor Sauberkeit!", greeting: "Hallo {name},", body: "Ihre Reinigung ist abgeschlossen und die Zahlung wurde eingezogen.", button: "Bewertung abgeben", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
    reviewReminder: { subject: "Erinnerung: Teilen Sie Ihre DORIXÉ-Erfahrung", body: "Nur eine freundliche Erinnerung, eine Bewertung für Ihre kürzliche Reinigung zu hinterlassen.", link: "Bewertung abgeben" },
    weeklyEarnings: { subject: "Ihre wöchentliche Verdienstübersicht: {amount}", heading: "Ihr Verdienst diese Woche", greeting: "Hallo {name},", earned: "Sie haben {amount} aus {count} Buchung(en) verdient.", period: "Zeitraum: {start} bis {end}", explainer: "Diese Beträge werden bei Abschluss jedes Auftrags direkt auf Ihr verbundenes Stripe-Konto ausgezahlt, und Stripe überweist sie gemäß dem Auszahlungsplan Ihres Kontos auf Ihr Bankkonto.", thanks: "Vielen Dank, dass Sie Teil von DORIXÉ sind 🌿" },
    reminderTomorrow: { subject: "Erinnerung: Ihre Reinigung ist morgen 🌿", heading: "Ihre Reinigung ist morgen!", greeting: "Hallo {name},", body: "Nur eine Erinnerung, dass Ihre Reinigung für {time} geplant ist.", addressLabel: "Adresse:", thanks: "Vielen Dank, dass Sie sich für DORIXÉ entschieden haben 🌿" },
  },
  fr: {
    bookingConfirmed: { subject: "Réservation confirmée — {number}", heading: "Votre réservation est confirmée !", labelNumber: "Numéro de réservation :", labelService: "Prestation :", labelScheduled: "Programmée :", preauth: "Votre carte a été préautorisée. Vous ne serez débité(e) qu'une fois le ménage terminé.", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
    reviewRequest: { subject: "Comment s'est passé votre ménage ? Laissez un avis 🌿", heading: "Votre intérieur est impeccable !", greeting: "Bonjour {name},", body: "Votre séance de ménage est terminée et le paiement a été prélevé.", button: "Laisser un avis", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
    reviewReminder: { subject: "Rappel : partagez votre expérience DORIXÉ", body: "Juste un petit rappel amical pour laisser un avis sur votre récent ménage.", link: "Laisser un avis" },
    weeklyEarnings: { subject: "Votre récapitulatif des gains de la semaine : {amount}", heading: "Vos gains cette semaine", greeting: "Bonjour {name},", earned: "Vous avez gagné {amount} sur {count} réservation(s).", period: "Période : du {start} au {end}", explainer: "Ces fonds sont versés directement sur votre compte Stripe connecté à mesure que chaque mission est terminée, et Stripe les reverse sur votre compte bancaire selon le calendrier de versement de votre compte.", thanks: "Merci de faire partie de DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Rappel : votre ménage est demain 🌿", heading: "Votre ménage est demain !", greeting: "Bonjour {name},", body: "Juste un rappel : votre séance de ménage est programmée pour {time}.", addressLabel: "Adresse :", thanks: "Merci d'avoir choisi DORIXÉ 🌿" },
  },
  es: {
    bookingConfirmed: { subject: "Reserva confirmada — {number}", heading: "¡Tu reserva está confirmada!", labelNumber: "Número de reserva:", labelService: "Servicio:", labelScheduled: "Programada:", preauth: "Tu tarjeta ha sido preautorizada. Solo se te cobrará una vez que la limpieza esté completada.", thanks: "Gracias por elegir DORIXÉ 🌿" },
    reviewRequest: { subject: "¿Qué tal fue tu limpieza? Deja una reseña 🌿", heading: "¡Tu hogar está reluciente!", greeting: "Hola {name}:", body: "Tu sesión de limpieza se ha completado y el pago se ha cobrado.", button: "Dejar una reseña", thanks: "Gracias por elegir DORIXÉ 🌿" },
    reviewReminder: { subject: "Recordatorio: comparte tu experiencia con DORIXÉ", body: "Solo un recordatorio amistoso para que dejes una reseña sobre tu limpieza reciente.", link: "Dejar una reseña" },
    weeklyEarnings: { subject: "Tu resumen de ganancias semanales: {amount}", heading: "Tus ganancias esta semana", greeting: "Hola {name}:", earned: "Has ganado {amount} en {count} reserva(s).", period: "Periodo: del {start} al {end}", explainer: "Estos fondos se abonan directamente en tu cuenta de Stripe conectada a medida que se completa cada trabajo, y Stripe los transfiere a tu banco según el calendario de pagos de tu cuenta.", thanks: "Gracias por formar parte de DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Recordatorio: tu limpieza es mañana 🌿", heading: "¡Tu limpieza es mañana!", greeting: "Hola {name}:", body: "Solo un recordatorio de que tu sesión de limpieza está programada para las {time}.", addressLabel: "Dirección:", thanks: "Gracias por elegir DORIXÉ 🌿" },
  },
  it: {
    bookingConfirmed: { subject: "Prenotazione confermata — {number}", heading: "La tua prenotazione è confermata!", labelNumber: "Numero di prenotazione:", labelService: "Servizio:", labelScheduled: "Programmata:", preauth: "La tua carta è stata preautorizzata. L'addebito avverrà solo al termine della pulizia.", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
    reviewRequest: { subject: "Com'è andata la pulizia? Lascia una recensione 🌿", heading: "La tua casa è splendente!", greeting: "Ciao {name},", body: "La tua sessione di pulizia è stata completata e il pagamento è stato addebitato.", button: "Lascia una recensione", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
    reviewReminder: { subject: "Promemoria: condividi la tua esperienza con DORIXÉ", body: "Solo un cordiale promemoria per lasciare una recensione sulla tua recente pulizia.", link: "Lascia una recensione" },
    weeklyEarnings: { subject: "Il riepilogo dei tuoi guadagni settimanali: {amount}", heading: "I tuoi guadagni questa settimana", greeting: "Ciao {name},", earned: "Hai guadagnato {amount} su {count} prenotazione/i.", period: "Periodo: dal {start} al {end}", explainer: "Questi importi vengono accreditati direttamente sul tuo account Stripe collegato al completamento di ogni lavoro, e Stripe li versa sul tuo conto bancario secondo il calendario dei pagamenti del tuo account.", thanks: "Grazie per far parte di DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Promemoria: la tua pulizia è domani 🌿", heading: "La tua pulizia è domani!", greeting: "Ciao {name},", body: "Solo un promemoria che la tua sessione di pulizia è programmata per le {time}.", addressLabel: "Indirizzo:", thanks: "Grazie per aver scelto DORIXÉ 🌿" },
  },
  nl: {
    bookingConfirmed: { subject: "Boeking bevestigd — {number}", heading: "Je boeking is bevestigd!", labelNumber: "Boekingsnummer:", labelService: "Dienst:", labelScheduled: "Gepland:", preauth: "Je kaart is voorgeautoriseerd. Er wordt pas afgeschreven zodra de schoonmaak is afgerond.", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
    reviewRequest: { subject: "Hoe was je schoonmaak? Laat een beoordeling achter 🌿", heading: "Je huis is brandschoon!", greeting: "Hoi {name},", body: "Je schoonmaaksessie is afgerond en de betaling is geïncasseerd.", button: "Beoordeling achterlaten", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
    reviewReminder: { subject: "Herinnering: deel je DORIXÉ-ervaring", body: "Even een vriendelijke herinnering om een beoordeling achter te laten voor je recente schoonmaak.", link: "Beoordeling achterlaten" },
    weeklyEarnings: { subject: "Je wekelijkse verdienstenoverzicht: {amount}", heading: "Je verdiensten deze week", greeting: "Hoi {name},", earned: "Je hebt {amount} verdiend met {count} boeking(en).", period: "Periode: {start} tot {end}", explainer: "Deze bedragen worden direct op je gekoppelde Stripe-account gestort zodra elke klus is afgerond, en Stripe betaalt ze uit op je bankrekening volgens het uitbetalingsschema van je account.", thanks: "Bedankt dat je deel uitmaakt van DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Herinnering: je schoonmaak is morgen 🌿", heading: "Je schoonmaak is morgen!", greeting: "Hoi {name},", body: "Even een herinnering dat je schoonmaaksessie gepland staat voor {time}.", addressLabel: "Adres:", thanks: "Bedankt dat je voor DORIXÉ hebt gekozen 🌿" },
  },
  pl: {
    bookingConfirmed: { subject: "Rezerwacja potwierdzona — {number}", heading: "Twoja rezerwacja została potwierdzona!", labelNumber: "Numer rezerwacji:", labelService: "Usługa:", labelScheduled: "Termin:", preauth: "Twoja karta została wstępnie autoryzowana. Opłata zostanie pobrana dopiero po zakończeniu sprzątania.", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
    reviewRequest: { subject: "Jak przebiegło sprzątanie? Zostaw opinię 🌿", heading: "Twój dom lśni czystością!", greeting: "Cześć {name},", body: "Twoja sesja sprzątania została zakończona, a płatność pobrana.", button: "Zostaw opinię", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
    reviewReminder: { subject: "Przypomnienie: podziel się swoim doświadczeniem z DORIXÉ", body: "To tylko przyjazne przypomnienie, aby zostawić opinię o niedawnym sprzątaniu.", link: "Zostaw opinię" },
    weeklyEarnings: { subject: "Twoje tygodniowe podsumowanie zarobków: {amount}", heading: "Twoje zarobki w tym tygodniu", greeting: "Cześć {name},", earned: "Zarobiłeś(-aś) {amount} z {count} rezerwacji.", period: "Okres: od {start} do {end}", explainer: "Środki te są przekazywane bezpośrednio na Twoje połączone konto Stripe po zakończeniu każdego zlecenia, a Stripe wypłaca je na Twoje konto bankowe zgodnie z harmonogramem wypłat Twojego konta.", thanks: "Dziękujemy, że jesteś częścią DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Przypomnienie: Twoje sprzątanie jest jutro 🌿", heading: "Twoje sprzątanie jest jutro!", greeting: "Cześć {name},", body: "Przypominamy, że Twoja sesja sprzątania jest zaplanowana na {time}.", addressLabel: "Adres:", thanks: "Dziękujemy za wybór DORIXÉ 🌿" },
  },
  pt: {
    bookingConfirmed: { subject: "Reserva confirmada — {number}", heading: "A sua reserva está confirmada!", labelNumber: "Número da reserva:", labelService: "Serviço:", labelScheduled: "Agendada:", preauth: "O seu cartão foi pré-autorizado. Só será cobrado depois de a limpeza estar concluída.", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
    reviewRequest: { subject: "Como correu a sua limpeza? Deixe uma avaliação 🌿", heading: "A sua casa está a brilhar!", greeting: "Olá {name},", body: "A sua sessão de limpeza foi concluída e o pagamento foi cobrado.", button: "Deixar uma avaliação", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
    reviewReminder: { subject: "Lembrete: partilhe a sua experiência com a DORIXÉ", body: "Apenas um lembrete amigável para deixar uma avaliação sobre a sua limpeza recente.", link: "Deixar uma avaliação" },
    weeklyEarnings: { subject: "O seu resumo de ganhos semanais: {amount}", heading: "Os seus ganhos esta semana", greeting: "Olá {name},", earned: "Ganhou {amount} em {count} reserva(s).", period: "Período: de {start} a {end}", explainer: "Estes valores são pagos diretamente para a sua conta Stripe associada à medida que cada trabalho é concluído, e a Stripe transfere-os para o seu banco de acordo com o calendário de pagamentos da sua conta.", thanks: "Obrigado por fazer parte da DORIXÉ 🌿" },
    reminderTomorrow: { subject: "Lembrete: a sua limpeza é amanhã 🌿", heading: "A sua limpeza é amanhã!", greeting: "Olá {name},", body: "Apenas um lembrete de que a sua sessão de limpeza está agendada para as {time}.", addressLabel: "Morada:", thanks: "Obrigado por escolher a DORIXÉ 🌿" },
  },
}

function loc(locale: string | null | undefined): string {
  return isLocale(locale) ? locale : defaultLocale
}
function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function sub(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : ""))
}
function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">${inner}</div>
  </div></body></html>`
}
const H1S = "font-family:Georgia,serif;font-size:22px;margin:0 0 14px;"
const PS = "margin:0 0 12px;"
const BTNS = "display:inline-block;background:#2D7A5F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;margin:6px 0;"
const THX = "margin:18px 0 0;color:#6B7280;font-size:13px;"

export function bookingConfirmedEmail(locale: string | null | undefined, v: { number: string; service: string; scheduled: string }) {
  const t = (TX[loc(locale)] ?? TX[defaultLocale]).bookingConfirmed
  const inner = `<h1 style="${H1S}">${t.heading}</h1>
    <p style="${PS}"><strong>${t.labelNumber}</strong> ${esc(v.number)}</p>
    <p style="${PS}">${t.labelService} ${esc(v.service)}</p>
    <p style="${PS}">${t.labelScheduled} ${esc(v.scheduled)}</p>
    <p style="${PS}">${t.preauth}</p>
    <p style="${THX}">${t.thanks}</p>`
  return { subject: sub(t.subject, { number: v.number }), html: shell(inner) }
}

export function reviewRequestEmail(locale: string | null | undefined, v: { name: string | null; reviewUrl: string }) {
  const t = (TX[loc(locale)] ?? TX[defaultLocale]).reviewRequest
  const name = v.name?.trim()
  const greeting = name ? `<p style="${PS}">${sub(t.greeting, { name: esc(name) })}</p>` : ""
  const inner = `<h1 style="${H1S}">${t.heading}</h1>${greeting}<p style="${PS}">${t.body}</p>
    <a href="${v.reviewUrl}" style="${BTNS}">${t.button}</a>
    <p style="${THX}">${t.thanks}</p>`
  return { subject: t.subject, html: shell(inner) }
}

export function reviewReminderEmail(locale: string | null | undefined, v: { reviewUrl: string }) {
  const t = (TX[loc(locale)] ?? TX[defaultLocale]).reviewReminder
  const inner = `<p style="${PS}">${t.body}</p><a href="${v.reviewUrl}" style="${BTNS}">${t.link}</a>`
  return { subject: t.subject, html: shell(inner) }
}

export function weeklyEarningsEmail(locale: string | null | undefined, v: { name: string | null; amount: string; count: number; start: string; end: string }) {
  const t = (TX[loc(locale)] ?? TX[defaultLocale]).weeklyEarnings
  const name = v.name?.trim()
  const greeting = name ? `<p style="${PS}">${sub(t.greeting, { name: esc(name) })}</p>` : ""
  const inner = `<h1 style="${H1S}">${t.heading}</h1>${greeting}
    <p style="${PS}">${sub(t.earned, { amount: v.amount, count: v.count })}</p>
    <p style="${PS}">${sub(t.period, { start: esc(v.start), end: esc(v.end) })}</p>
    <p style="${PS}">${t.explainer}</p>
    <p style="${THX}">${t.thanks}</p>`
  return { subject: sub(t.subject, { amount: v.amount }), html: shell(inner) }
}

export function reminderTomorrowEmail(locale: string | null | undefined, v: { name: string | null; time: string; address?: string }) {
  const t = (TX[loc(locale)] ?? TX[defaultLocale]).reminderTomorrow
  const name = v.name?.trim()
  const greeting = name ? `<p style="${PS}">${sub(t.greeting, { name: esc(name) })}</p>` : ""
  const addrLine = v.address ? `<p style="${PS}">${t.addressLabel} ${esc(v.address)}</p>` : ""
  const inner = `<h1 style="${H1S}">${t.heading}</h1>${greeting}
    <p style="${PS}">${sub(t.body, { time: esc(v.time) })}</p>${addrLine}
    <p style="${THX}">${t.thanks}</p>`
  return { subject: t.subject, html: shell(inner) }
}

// Cleaner "your job is overdue" email. {number}, {date}.
const OVERDUE: Record<string, { subject: string; heading: string; body: string }> = {
  en: { subject: "Your job is overdue — {number}", heading: "Your job is overdue", body: "Your cleaning job {number} scheduled for {date} is overdue. Please complete it as soon as possible — a late fee of 5% per day applies until it is marked done." },
  de: { subject: "Dein Auftrag ist überfällig — {number}", heading: "Dein Auftrag ist überfällig", body: "Dein Reinigungsauftrag {number} für {date} ist überfällig. Bitte schließe ihn so schnell wie möglich ab — es fällt eine Gebühr von 5 % pro Tag an, bis er als erledigt markiert ist." },
  fr: { subject: "Votre mission est en retard — {number}", heading: "Votre mission est en retard", body: "Votre mission de nettoyage {number} prévue le {date} est en retard. Veuillez la terminer dès que possible — des frais de retard de 5 %/jour s'appliquent jusqu'à ce qu'elle soit marquée comme terminée." },
  es: { subject: "Tu trabajo está atrasado — {number}", heading: "Tu trabajo está atrasado", body: "Tu trabajo de limpieza {number} programado para el {date} está atrasado. Complétalo lo antes posible — se aplica un recargo del 5 %/día hasta que se marque como completado." },
  it: { subject: "Il tuo lavoro è in ritardo — {number}", heading: "Il tuo lavoro è in ritardo", body: "Il tuo lavoro di pulizia {number} previsto per il {date} è in ritardo. Completalo il prima possibile — si applica una penale del 5%/giorno finché non viene contrassegnato come completato." },
  nl: { subject: "Je klus is te laat — {number}", heading: "Je klus is te laat", body: "Je schoonmaakklus {number} gepland voor {date} is te laat. Rond hem zo snel mogelijk af — er geldt een boete van 5%/dag totdat hij als voltooid is gemarkeerd." },
  pl: { subject: "Twoje zlecenie jest zaległe — {number}", heading: "Twoje zlecenie jest zaległe", body: "Twoje zlecenie sprzątania {number} zaplanowane na {date} jest zaległe. Wykonaj je jak najszybciej — naliczana jest opłata 5%/dzień, dopóki nie zostanie oznaczone jako wykonane." },
  pt: { subject: "O teu trabalho está em atraso — {number}", heading: "O teu trabalho está em atraso", body: "O teu trabalho de limpeza {number} agendado para {date} está em atraso. Conclui-o o mais rápido possível — aplica-se uma taxa de 5%/dia até ser marcado como concluído." },
}

export function overdueEmail(locale: string | null | undefined, v: { number: string; date: string }) {
  const t = OVERDUE[loc(locale)] ?? OVERDUE[defaultLocale]
  const inner = `<h1 style="${H1S}">${t.heading}</h1><p style="${PS}">${sub(t.body, { number: esc(v.number), date: esc(v.date) })}</p>`
  return { subject: sub(t.subject, { number: v.number }), html: shell(inner) }
}

// Client "new bid on your job" email — sent for the FIRST THREE bids only. {name}, {amount}, {title}.
const NEW_BID: Record<string, { subject: string; heading: string; body: string }> = {
  en: { subject: "New bid on your job — {name}", heading: "You received a new bid", body: "{name} offered {amount} for your job “{title}”. Log in to compare bids and accept the one you like." },
  de: { subject: "Neues Angebot für deinen Auftrag — {name}", heading: "Du hast ein neues Angebot", body: "{name} bietet {amount} für deinen Auftrag „{title}“. Melde dich an, um Angebote zu vergleichen und das passende anzunehmen." },
  fr: { subject: "Nouvelle offre pour votre annonce — {name}", heading: "Vous avez reçu une nouvelle offre", body: "{name} propose {amount} pour votre annonce « {title} ». Connectez-vous pour comparer les offres et accepter celle qui vous convient." },
  es: { subject: "Nueva oferta para tu trabajo — {name}", heading: "Has recibido una nueva oferta", body: "{name} ofrece {amount} por tu trabajo «{title}». Inicia sesión para comparar ofertas y aceptar la que prefieras." },
  it: { subject: "Nuova offerta per il tuo lavoro — {name}", heading: "Hai ricevuto una nuova offerta", body: "{name} offre {amount} per il tuo lavoro “{title}”. Accedi per confrontare le offerte e accettare quella che preferisci." },
  nl: { subject: "Nieuw bod op je klus — {name}", heading: "Je hebt een nieuw bod", body: "{name} biedt {amount} voor je klus “{title}”. Log in om biedingen te vergelijken en het beste te accepteren." },
  pl: { subject: "Nowa oferta na Twoje zlecenie — {name}", heading: "Masz nową ofertę", body: "{name} oferuje {amount} za Twoje zlecenie „{title}”. Zaloguj się, aby porównać oferty i zaakceptować najlepszą." },
  pt: { subject: "Nova proposta para o teu trabalho — {name}", heading: "Recebeste uma nova proposta", body: "{name} propõe {amount} pelo teu trabalho “{title}”. Inicia sessão para comparar propostas e aceitar a que preferires." },
}

export function newBidEmail(locale: string | null | undefined, v: { name: string; amount: string; title: string }) {
  const t = NEW_BID[loc(locale)] ?? NEW_BID[defaultLocale]
  const inner = `<h1 style="${H1S}">${t.heading}</h1><p style="${PS}">${sub(t.body, { name: esc(v.name), amount: esc(v.amount), title: esc(v.title) })}</p>`
  return { subject: sub(t.subject, { name: v.name }), html: shell(inner) }
}

// Cleaner "your bid was accepted" email — always sent (money-relevant). {amount}.
const BID_ACCEPTED: Record<string, { subject: string; heading: string; body: string }> = {
  en: { subject: "Your bid was accepted 🎉", heading: "Your bid was accepted!", body: "A client accepted your bid of {amount}. Open your bookings to see the schedule and next steps." },
  de: { subject: "Dein Angebot wurde angenommen 🎉", heading: "Dein Angebot wurde angenommen!", body: "Ein Kunde hat dein Angebot über {amount} angenommen. Öffne deine Buchungen für Termin und nächste Schritte." },
  fr: { subject: "Votre offre a été acceptée 🎉", heading: "Votre offre a été acceptée !", body: "Un client a accepté votre offre de {amount}. Ouvrez vos réservations pour voir le planning et les prochaines étapes." },
  es: { subject: "Tu oferta fue aceptada 🎉", heading: "¡Tu oferta fue aceptada!", body: "Un cliente aceptó tu oferta de {amount}. Abre tus reservas para ver el horario y los próximos pasos." },
  it: { subject: "La tua offerta è stata accettata 🎉", heading: "La tua offerta è stata accettata!", body: "Un cliente ha accettato la tua offerta di {amount}. Apri le tue prenotazioni per vedere il programma e i prossimi passi." },
  nl: { subject: "Je bod is geaccepteerd 🎉", heading: "Je bod is geaccepteerd!", body: "Een klant heeft je bod van {amount} geaccepteerd. Open je boekingen voor de planning en de volgende stappen." },
  pl: { subject: "Twoja oferta została przyjęta 🎉", heading: "Twoja oferta została przyjęta!", body: "Klient zaakceptował Twoją ofertę {amount}. Otwórz swoje rezerwacje, aby zobaczyć harmonogram i kolejne kroki." },
  pt: { subject: "A tua proposta foi aceite 🎉", heading: "A tua proposta foi aceite!", body: "Um cliente aceitou a tua proposta de {amount}. Abre as tuas reservas para ver o horário e os próximos passos." },
}

// New chat message about a job — {title}, {snippet}.
const NEW_MESSAGE: Record<string, { subject: string; heading: string; body: string }> = {
  en: { subject: "New message — “{title}”", heading: "You have a new message", body: "New message about “{title}”: “{snippet}”. Log in to DORIXÉ to reply." },
  de: { subject: "Neue Nachricht — „{title}“", heading: "Du hast eine neue Nachricht", body: "Neue Nachricht zu „{title}“: „{snippet}“. Melde dich bei DORIXÉ an, um zu antworten." },
  fr: { subject: "Nouveau message — « {title} »", heading: "Vous avez un nouveau message", body: "Nouveau message concernant « {title} » : « {snippet} ». Connectez-vous à DORIXÉ pour répondre." },
  es: { subject: "Nuevo mensaje — «{title}»", heading: "Tienes un nuevo mensaje", body: "Nuevo mensaje sobre «{title}»: «{snippet}». Inicia sesión en DORIXÉ para responder." },
  it: { subject: "Nuovo messaggio — “{title}”", heading: "Hai un nuovo messaggio", body: "Nuovo messaggio su “{title}”: “{snippet}”. Accedi a DORIXÉ per rispondere." },
  nl: { subject: "Nieuw bericht — “{title}”", heading: "Je hebt een nieuw bericht", body: "Nieuw bericht over “{title}”: “{snippet}”. Log in bij DORIXÉ om te antwoorden." },
  pl: { subject: "Nowa wiadomość — „{title}”", heading: "Masz nową wiadomość", body: "Nowa wiadomość dotycząca „{title}”: „{snippet}”. Zaloguj się do DORIXÉ, aby odpowiedzieć." },
  pt: { subject: "Nova mensagem — “{title}”", heading: "Tens uma nova mensagem", body: "Nova mensagem sobre “{title}”: “{snippet}”. Inicia sessão na DORIXÉ para responder." },
}

export function newMessageEmail(locale: string | null | undefined, v: { title: string; snippet: string }) {
  const t = NEW_MESSAGE[loc(locale)] ?? NEW_MESSAGE[defaultLocale]
  const inner = `<h1 style="${H1S}">${t.heading}</h1><p style="${PS}">${sub(t.body, { title: esc(v.title), snippet: esc(v.snippet) })}</p>`
  return { subject: sub(t.subject, { title: v.title }), html: shell(inner) }
}

export function bidAcceptedEmail(locale: string | null | undefined, v: { amount: string }) {
  const t = BID_ACCEPTED[loc(locale)] ?? BID_ACCEPTED[defaultLocale]
  const inner = `<h1 style="${H1S}">${t.heading}</h1><p style="${PS}">${sub(t.body, { amount: esc(v.amount) })}</p>`
  return { subject: t.subject, html: shell(inner) }
}
