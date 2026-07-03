import { isLocale, defaultLocale } from "@/i18n/config"

// 8-locale in-app notification copy, keyed by notification type. {placeholders} are filled from the
// notification's `metadata` at RENDER time, in the VIEWER's UI locale. Static types (no params)
// localize unconditionally; dynamic types localize only when metadata carries their params — otherwise
// we fall back to the stored (English) title/body so a placeholder never renders empty.

type S = { title: string; body: string }

const NOTIF: Record<string, Record<string, S>> = {
  new_job_request: {
    en: { title: "New {category} job in {city}", body: "A customer needs {category} help in {city}. They are {distance} from you — be one of the first to bid!" },
    de: { title: "Neuer {category}-Auftrag in {city}", body: "Ein Kunde braucht {category}-Hilfe in {city}. Er ist {distance} von dir entfernt — sei einer der Ersten, die ein Angebot abgeben!" },
    fr: { title: "Nouvelle mission de {category} à {city}", body: "Un client a besoin d'aide pour {category} à {city}. Il se trouve à {distance} de chez vous — soyez parmi les premiers à proposer une offre !" },
    es: { title: "Nuevo trabajo de {category} en {city}", body: "Un cliente necesita ayuda de {category} en {city}. Está a {distance} de ti — ¡sé uno de los primeros en pujar!" },
    it: { title: "Nuovo lavoro di {category} a {city}", body: "Un cliente ha bisogno di aiuto per {category} a {city}. Si trova a {distance} da te — sii tra i primi a fare un'offerta!" },
    nl: { title: "Nieuwe {category}-klus in {city}", body: "Een klant heeft hulp nodig met {category} in {city}. Hij is {distance} bij je vandaan — wees een van de eersten die een bod doet!" },
    pl: { title: "Nowe zlecenie {category} w {city}", body: "Klient potrzebuje pomocy przy {category} w {city}. Jest {distance} od Ciebie — bądź jednym z pierwszych, którzy złożą ofertę!" },
    pt: { title: "Novo trabalho de {category} em {city}", body: "Um cliente precisa de ajuda com {category} em {city}. Está a {distance} de si — seja um dos primeiros a fazer uma proposta!" },
  },
  bid_received: {
    en: { title: "New bid from {name}", body: "{amount} — {message}" },
    de: { title: "Neues Angebot von {name}", body: "{amount} — {message}" },
    fr: { title: "Nouvelle offre de {name}", body: "{amount} — {message}" },
    es: { title: "Nueva oferta de {name}", body: "{amount} — {message}" },
    it: { title: "Nuova offerta da {name}", body: "{amount} — {message}" },
    nl: { title: "Nieuw bod van {name}", body: "{amount} — {message}" },
    pl: { title: "Nowa oferta od {name}", body: "{amount} — {message}" },
    pt: { title: "Nova proposta de {name}", body: "{amount} — {message}" },
  },
  bid_accepted: {
    en: { title: "Your bid was accepted!", body: "A customer accepted your bid of {amount}. A booking is being prepared." },
    de: { title: "Dein Angebot wurde angenommen!", body: "Ein Kunde hat dein Angebot über {amount} angenommen. Eine Buchung wird vorbereitet." },
    fr: { title: "Votre offre a été acceptée !", body: "Un client a accepté votre offre de {amount}. Une réservation est en cours de préparation." },
    es: { title: "¡Tu oferta fue aceptada!", body: "Un cliente aceptó tu oferta de {amount}. Se está preparando una reserva." },
    it: { title: "La tua offerta è stata accettata!", body: "Un cliente ha accettato la tua offerta di {amount}. Una prenotazione è in preparazione." },
    nl: { title: "Je bod is geaccepteerd!", body: "Een klant heeft je bod van {amount} geaccepteerd. Een boeking wordt voorbereid." },
    pl: { title: "Twoja oferta została zaakceptowana!", body: "Klient zaakceptował Twoją ofertę na {amount}. Rezerwacja jest przygotowywana." },
    pt: { title: "A sua proposta foi aceite!", body: "Um cliente aceitou a sua proposta de {amount}. Uma reserva está a ser preparada." },
  },
  booking_confirmed: {
    en: { title: "Your booking has been confirmed!", body: "Your cleaning provider has confirmed your booking." },
    de: { title: "Deine Buchung wurde bestätigt!", body: "Deine Reinigungskraft hat deine Buchung bestätigt." },
    fr: { title: "Votre réservation a été confirmée !", body: "Votre intervenant de nettoyage a confirmé votre réservation." },
    es: { title: "¡Tu reserva ha sido confirmada!", body: "Tu profesional de limpieza ha confirmado tu reserva." },
    it: { title: "La tua prenotazione è stata confermata!", body: "Il tuo addetto alle pulizie ha confermato la tua prenotazione." },
    nl: { title: "Je boeking is bevestigd!", body: "Je schoonmaker heeft je boeking bevestigd." },
    pl: { title: "Twoja rezerwacja została potwierdzona!", body: "Twoja osoba sprzątająca potwierdziła Twoją rezerwację." },
    pt: { title: "A sua reserva foi confirmada!", body: "O seu profissional de limpeza confirmou a sua reserva." },
  },
  booking_reminder: {
    en: { title: "Booking tomorrow", body: "You have a cleaning job scheduled for tomorrow at {datetime}." },
    de: { title: "Buchung morgen", body: "Du hast morgen um {datetime} einen Reinigungsauftrag." },
    fr: { title: "Réservation demain", body: "Vous avez une mission de nettoyage prévue demain à {datetime}." },
    es: { title: "Reserva mañana", body: "Tienes un trabajo de limpieza programado para mañana a las {datetime}." },
    it: { title: "Prenotazione domani", body: "Hai un lavoro di pulizia previsto per domani alle {datetime}." },
    nl: { title: "Boeking morgen", body: "Je hebt morgen om {datetime} een schoonmaakklus gepland." },
    pl: { title: "Rezerwacja jutro", body: "Masz zaplanowane sprzątanie na jutro o {datetime}." },
    pt: { title: "Reserva amanhã", body: "Tem um trabalho de limpeza agendado para amanhã às {datetime}." },
  },
  booking_completed: {
    en: { title: "Cleaning Complete — Leave a Review", body: "Your cleaning session is done! Share your experience to help others." },
    de: { title: "Reinigung abgeschlossen — Bewertung abgeben", body: "Deine Reinigung ist abgeschlossen! Teile deine Erfahrung, um anderen zu helfen." },
    fr: { title: "Nettoyage terminé — Laissez un avis", body: "Votre séance de nettoyage est terminée ! Partagez votre expérience pour aider les autres." },
    es: { title: "Limpieza completada — Deja una reseña", body: "¡Tu sesión de limpieza ha terminado! Comparte tu experiencia para ayudar a otros." },
    it: { title: "Pulizia completata — Lascia una recensione", body: "La tua sessione di pulizia è terminata! Condividi la tua esperienza per aiutare gli altri." },
    nl: { title: "Schoonmaak voltooid — Laat een review achter", body: "Je schoonmaaksessie is klaar! Deel je ervaring om anderen te helpen." },
    pl: { title: "Sprzątanie zakończone — Wystaw opinię", body: "Twoja sesja sprzątania dobiegła końca! Podziel się swoim doświadczeniem, aby pomóc innym." },
    pt: { title: "Limpeza concluída — Deixe uma avaliação", body: "A sua sessão de limpeza terminou! Partilhe a sua experiência para ajudar outros." },
  },
  booking_cancelled: {
    en: { title: "Payment failed", body: "Your payment could not be processed. Please try again with a different payment method." },
    de: { title: "Zahlung fehlgeschlagen", body: "Deine Zahlung konnte nicht verarbeitet werden. Bitte versuche es mit einer anderen Zahlungsmethode erneut." },
    fr: { title: "Échec du paiement", body: "Votre paiement n'a pas pu être traité. Veuillez réessayer avec un autre moyen de paiement." },
    es: { title: "Pago fallido", body: "No se pudo procesar tu pago. Inténtalo de nuevo con otro método de pago." },
    it: { title: "Pagamento non riuscito", body: "Non è stato possibile elaborare il tuo pagamento. Riprova con un altro metodo di pagamento." },
    nl: { title: "Betaling mislukt", body: "Je betaling kon niet worden verwerkt. Probeer het opnieuw met een andere betaalmethode." },
    pl: { title: "Płatność nieudana", body: "Nie udało się przetworzyć Twojej płatności. Spróbuj ponownie, używając innej metody płatności." },
    pt: { title: "Pagamento falhou", body: "Não foi possível processar o seu pagamento. Tente novamente com outro método de pagamento." },
  },
  dispute_opened: {
    en: { title: "A dispute has been opened", body: "Reason: {reason}. Please respond within 72 hours." },
    de: { title: "Ein Streitfall wurde eröffnet", body: "Grund: {reason}. Bitte antworte innerhalb von 72 Stunden." },
    fr: { title: "Un litige a été ouvert", body: "Motif : {reason}. Veuillez répondre dans les 72 heures." },
    es: { title: "Se ha abierto una disputa", body: "Motivo: {reason}. Por favor, responde en un plazo de 72 horas." },
    it: { title: "È stata aperta una contestazione", body: "Motivo: {reason}. Si prega di rispondere entro 72 ore." },
    nl: { title: "Er is een geschil geopend", body: "Reden: {reason}. Reageer binnen 72 uur." },
    pl: { title: "Otwarto spór", body: "Powód: {reason}. Prosimy o odpowiedź w ciągu 72 godzin." },
    pt: { title: "Foi aberta uma disputa", body: "Motivo: {reason}. Por favor, responda no prazo de 72 horas." },
  },
  dispute_resolved: {
    en: { title: "Your dispute has been resolved", body: "{resolution}" },
    de: { title: "Dein Streitfall wurde gelöst", body: "{resolution}" },
    fr: { title: "Votre litige a été résolu", body: "{resolution}" },
    es: { title: "Tu disputa ha sido resuelta", body: "{resolution}" },
    it: { title: "La tua contestazione è stata risolta", body: "{resolution}" },
    nl: { title: "Je geschil is opgelost", body: "{resolution}" },
    pl: { title: "Twój spór został rozwiązany", body: "{resolution}" },
    pt: { title: "A sua disputa foi resolvida", body: "{resolution}" },
  },
  provider_approved: {
    en: { title: "You're approved — welcome to DORIXÉ!", body: "Your cleaner account is active. You can now browse jobs and place bids." },
    de: { title: "Du bist freigeschaltet — willkommen bei DORIXÉ!", body: "Dein Reinigungskraft-Konto ist aktiv. Du kannst jetzt Aufträge durchsuchen und Angebote abgeben." },
    fr: { title: "Vous êtes approuvé — bienvenue chez DORIXÉ !", body: "Votre compte de nettoyage est actif. Vous pouvez désormais parcourir les missions et faire des offres." },
    es: { title: "Estás aprobado — ¡bienvenido a DORIXÉ!", body: "Tu cuenta de limpieza está activa. Ya puedes explorar trabajos y hacer ofertas." },
    it: { title: "Sei approvato — benvenuto su DORIXÉ!", body: "Il tuo account come addetto alle pulizie è attivo. Ora puoi sfogliare i lavori e fare offerte." },
    nl: { title: "Je bent goedgekeurd — welkom bij DORIXÉ!", body: "Je schoonmaakaccount is actief. Je kunt nu klussen bekijken en biedingen doen." },
    pl: { title: "Zostałeś zatwierdzony — witamy w DORIXÉ!", body: "Twoje konto osoby sprzątającej jest aktywne. Możesz teraz przeglądać zlecenia i składać oferty." },
    pt: { title: "Está aprovado — bem-vindo à DORIXÉ!", body: "A sua conta de limpeza está ativa. Já pode explorar trabalhos e fazer propostas." },
  },
  provider_suspended: {
    en: { title: "Account suspended", body: "Your DORIXÉ cleaner account has been suspended by an administrator. Please contact support." },
    de: { title: "Konto gesperrt", body: "Dein DORIXÉ Reinigungskraft-Konto wurde von einem Administrator gesperrt. Bitte wende dich an den Support." },
    fr: { title: "Compte suspendu", body: "Votre compte de nettoyage DORIXÉ a été suspendu par un administrateur. Veuillez contacter le support." },
    es: { title: "Cuenta suspendida", body: "Un administrador ha suspendido tu cuenta de limpieza DORIXÉ. Por favor, contacta con el soporte." },
    it: { title: "Account sospeso", body: "Il tuo account come addetto alle pulizie DORIXÉ è stato sospeso da un amministratore. Contatta l'assistenza." },
    nl: { title: "Account opgeschort", body: "Je DORIXÉ schoonmaakaccount is door een beheerder opgeschort. Neem contact op met de klantenservice." },
    pl: { title: "Konto zawieszone", body: "Twoje konto osoby sprzątającej DORIXÉ zostało zawieszone przez administratora. Skontaktuj się z pomocą techniczną." },
    pt: { title: "Conta suspensa", body: "A sua conta de limpeza DORIXÉ foi suspensa por um administrador. Por favor, contacte o suporte." },
  },
  provider_unsuspended: {
    en: { title: "Account reinstated", body: "Your DORIXÉ cleaner account has been reinstated." },
    de: { title: "Konto wiederhergestellt", body: "Dein DORIXÉ Reinigungskraft-Konto wurde wiederhergestellt." },
    fr: { title: "Compte rétabli", body: "Votre compte de nettoyage DORIXÉ a été rétabli." },
    es: { title: "Cuenta restablecida", body: "Tu cuenta de limpieza DORIXÉ ha sido restablecida." },
    it: { title: "Account ripristinato", body: "Il tuo account come addetto alle pulizie DORIXÉ è stato ripristinato." },
    nl: { title: "Account hersteld", body: "Je DORIXÉ schoonmaakaccount is hersteld." },
    pl: { title: "Konto przywrócone", body: "Twoje konto osoby sprzątającej DORIXÉ zostało przywrócone." },
    pt: { title: "Conta reativada", body: "A sua conta de limpeza DORIXÉ foi reativada." },
  },
  new_message: {
    en: { title: "New message", body: "{message}" },
    de: { title: "Neue Nachricht", body: "{message}" },
    fr: { title: "Nouveau message", body: "{message}" },
    es: { title: "Nuevo mensaje", body: "{message}" },
    it: { title: "Nuovo messaggio", body: "{message}" },
    nl: { title: "Nieuw bericht", body: "{message}" },
    pl: { title: "Nowa wiadomość", body: "{message}" },
    pt: { title: "Nova mensagem", body: "{message}" },
  },
  booking_rescheduled: {
    en: { title: "Booking rescheduled", body: "Your booking has been rescheduled." },
    de: { title: "Buchung verschoben", body: "Deine Buchung wurde verschoben." },
    fr: { title: "Réservation reprogrammée", body: "Votre réservation a été reprogrammée." },
    es: { title: "Reserva reprogramada", body: "Tu reserva ha sido reprogramada." },
    it: { title: "Prenotazione riprogrammata", body: "La tua prenotazione è stata riprogrammata." },
    nl: { title: "Boeking verzet", body: "Je boeking is verzet." },
    pl: { title: "Rezerwacja przełożona", body: "Twoja rezerwacja została przełożona." },
    pt: { title: "Reserva reagendada", body: "A sua reserva foi reagendada." },
  },
  booking_started: {
    en: { title: "Your cleaner has arrived!", body: "Your cleaning session has begun." },
    de: { title: "Deine Reinigungskraft ist da!", body: "Deine Reinigung hat begonnen." },
    fr: { title: "Votre intervenant est arrivé !", body: "Votre séance de nettoyage a commencé." },
    es: { title: "¡Tu profesional de limpieza ha llegado!", body: "Tu sesión de limpieza ha comenzado." },
    it: { title: "Il tuo addetto alle pulizie è arrivato!", body: "La tua sessione di pulizia è iniziata." },
    nl: { title: "Je schoonmaker is gearriveerd!", body: "Je schoonmaaksessie is begonnen." },
    pl: { title: "Twoja osoba sprzątająca dotarła na miejsce!", body: "Twoja sesja sprzątania się rozpoczęła." },
    pt: { title: "O seu profissional de limpeza chegou!", body: "A sua sessão de limpeza começou." },
  },
  recurring_booking_created: {
    en: { title: "Recurring booking scheduled", body: "Your recurring booking has been scheduled for {datetime}." },
    de: { title: "Wiederkehrende Buchung geplant", body: "Deine wiederkehrende Buchung wurde für {datetime} geplant." },
    fr: { title: "Réservation récurrente planifiée", body: "Votre réservation récurrente a été planifiée pour le {datetime}." },
    es: { title: "Reserva recurrente programada", body: "Tu reserva recurrente ha sido programada para el {datetime}." },
    it: { title: "Prenotazione ricorrente pianificata", body: "La tua prenotazione ricorrente è stata pianificata per il {datetime}." },
    nl: { title: "Terugkerende boeking ingepland", body: "Je terugkerende boeking is ingepland voor {datetime}." },
    pl: { title: "Zaplanowano cykliczną rezerwację", body: "Twoja cykliczna rezerwacja została zaplanowana na {datetime}." },
    pt: { title: "Reserva recorrente agendada", body: "A sua reserva recorrente foi agendada para {datetime}." },
  },
  // recurring_booking_created sub-variants — selected via metadata.variant. The DB enum can't grow
  // without a migration, so these reuse the recurring_booking_created enum value but localize to the
  // correct message for the actual event (payment failure / skipped cycle).
  recurring_payment_failed: {
    en: { title: "Recurring booking payment failed", body: "We couldn't charge your saved card for the booking on {datetime}. Please update your payment method to keep your recurring schedule active." },
    de: { title: "Zahlung der wiederkehrenden Buchung fehlgeschlagen", body: "Wir konnten deine gespeicherte Karte für die Buchung am {datetime} nicht belasten. Bitte aktualisiere deine Zahlungsmethode, um deinen wiederkehrenden Plan aktiv zu halten." },
    fr: { title: "Échec du paiement de la réservation récurrente", body: "Nous n'avons pas pu débiter votre carte enregistrée pour la réservation du {datetime}. Veuillez mettre à jour votre moyen de paiement pour maintenir votre programme récurrent actif." },
    es: { title: "Error en el pago de la reserva recurrente", body: "No pudimos cobrar en tu tarjeta guardada la reserva del {datetime}. Actualiza tu método de pago para mantener activa tu programación recurrente." },
    it: { title: "Pagamento della prenotazione ricorrente non riuscito", body: "Non siamo riusciti ad addebitare la tua carta salvata per la prenotazione del {datetime}. Aggiorna il tuo metodo di pagamento per mantenere attiva la tua pianificazione ricorrente." },
    nl: { title: "Betaling van terugkerende boeking mislukt", body: "We konden je opgeslagen kaart niet belasten voor de boeking op {datetime}. Werk je betaalmethode bij om je terugkerende schema actief te houden." },
    pl: { title: "Płatność za cykliczną rezerwację nie powiodła się", body: "Nie udało się obciążyć Twojej zapisanej karty za rezerwację w dniu {datetime}. Zaktualizuj metodę płatności, aby Twój harmonogram cykliczny pozostał aktywny." },
    pt: { title: "Pagamento da reserva recorrente falhou", body: "Não conseguimos cobrar o seu cartão guardado para a reserva de {datetime}. Atualize o seu método de pagamento para manter o seu agendamento recorrente ativo." },
  },
  recurring_skipped: {
    en: { title: "Recurring booking skipped", body: "Your recurring cleaner is temporarily unavailable, so this cycle was skipped. We'll try again next time." },
    de: { title: "Wiederkehrende Buchung übersprungen", body: "Deine wiederkehrende Reinigungskraft ist vorübergehend nicht verfügbar, daher wurde dieser Zyklus übersprungen. Wir versuchen es beim nächsten Mal erneut." },
    fr: { title: "Réservation récurrente ignorée", body: "Votre intervenant récurrent est temporairement indisponible, ce cycle a donc été ignoré. Nous réessaierons la prochaine fois." },
    es: { title: "Reserva recurrente omitida", body: "Tu profesional de limpieza recurrente no está disponible temporalmente, así que se omitió este ciclo. Lo intentaremos de nuevo la próxima vez." },
    it: { title: "Prenotazione ricorrente saltata", body: "Il tuo addetto alle pulizie ricorrente è temporaneamente non disponibile, quindi questo ciclo è stato saltato. Riproveremo la prossima volta." },
    nl: { title: "Terugkerende boeking overgeslagen", body: "Je terugkerende schoonmaker is tijdelijk niet beschikbaar, dus deze cyclus is overgeslagen. We proberen het de volgende keer opnieuw." },
    pl: { title: "Pominięto cykliczną rezerwację", body: "Twoja cykliczna osoba sprzątająca jest tymczasowo niedostępna, więc ten cykl został pominięty. Spróbujemy ponownie następnym razem." },
    pt: { title: "Reserva recorrente ignorada", body: "O seu profissional de limpeza recorrente está temporariamente indisponível, pelo que este ciclo foi ignorado. Tentaremos novamente da próxima vez." },
  },
  // Time-agnostic CLIENT reminder ({datetime} carries day-before vs same-day specifics). The base
  // booking_reminder copy is cleaner-perspective, so clients need their own wording.
  booking_reminder_client: {
    en: { title: "Upcoming cleaning", body: "Reminder — your cleaning is scheduled for {datetime}." },
    de: { title: "Bevorstehende Reinigung", body: "Erinnerung — deine Reinigung ist für {datetime} geplant." },
    fr: { title: "Nettoyage à venir", body: "Rappel — votre ménage est prévu pour le {datetime}." },
    es: { title: "Limpieza próxima", body: "Recordatorio: tu limpieza está programada para el {datetime}." },
    it: { title: "Pulizia in arrivo", body: "Promemoria — la tua pulizia è prevista per il {datetime}." },
    nl: { title: "Aankomende schoonmaak", body: "Herinnering — je schoonmaak staat gepland voor {datetime}." },
    pl: { title: "Nadchodzące sprzątanie", body: "Przypomnienie — Twoje sprzątanie jest zaplanowane na {datetime}." },
    pt: { title: "Limpeza a chegar", body: "Lembrete — a sua limpeza está agendada para {datetime}." },
  },
  // Cancellation notice sent to the OTHER party (booking_cancelled base copy means "Payment failed").
  booking_cancelled_party: {
    en: { title: "Booking cancelled", body: "Your booking scheduled for {datetime} has been cancelled." },
    de: { title: "Buchung storniert", body: "Deine Buchung für {datetime} wurde storniert." },
    fr: { title: "Réservation annulée", body: "Votre réservation prévue le {datetime} a été annulée." },
    es: { title: "Reserva cancelada", body: "Tu reserva del {datetime} ha sido cancelada." },
    it: { title: "Prenotazione annullata", body: "La tua prenotazione del {datetime} è stata annullata." },
    nl: { title: "Boeking geannuleerd", body: "Je boeking voor {datetime} is geannuleerd." },
    pl: { title: "Rezerwacja anulowana", body: "Twoja rezerwacja na {datetime} została anulowana." },
    pt: { title: "Reserva cancelada", body: "A sua reserva de {datetime} foi cancelada." },
  },
  // Provider "new booking" (the base booking_confirmed copy is client-perspective, so the provider
  // notification mislocalized to "your booking is confirmed" without this variant).
  new_booking_provider: {
    en: { title: "New booking!", body: "You have a new booking for {service} on {datetime}." },
    de: { title: "Neue Buchung!", body: "Du hast eine neue Buchung für {service} am {datetime}." },
    fr: { title: "Nouvelle réservation !", body: "Vous avez une nouvelle réservation pour {service} le {datetime}." },
    es: { title: "¡Nueva reserva!", body: "Tienes una nueva reserva de {service} el {datetime}." },
    it: { title: "Nuova prenotazione!", body: "Hai una nuova prenotazione per {service} il {datetime}." },
    nl: { title: "Nieuwe boeking!", body: "Je hebt een nieuwe boeking voor {service} op {datetime}." },
    pl: { title: "Nowa rezerwacja!", body: "Masz nową rezerwację na {service} w dniu {datetime}." },
    pt: { title: "Nova reserva!", body: "Tens uma nova reserva de {service} em {datetime}." },
  },
  // Same as new_booking_provider but the client requested RECURRING work — flag it to the cleaner.
  new_booking_provider_recurring: {
    en: { title: "New recurring booking!", body: "You have a new recurring booking for {service} on {datetime}. The client wants regular repeat cleaning." },
    de: { title: "Neue wiederkehrende Buchung!", body: "Du hast eine neue wiederkehrende Buchung für {service} am {datetime}. Der Kunde wünscht regelmäßige Reinigung." },
    fr: { title: "Nouvelle réservation récurrente !", body: "Vous avez une nouvelle réservation récurrente pour {service} le {datetime}. Le client souhaite un ménage régulier." },
    es: { title: "¡Nueva reserva recurrente!", body: "Tienes una nueva reserva recurrente de {service} el {datetime}. El cliente quiere una limpieza periódica." },
    it: { title: "Nuova prenotazione ricorrente!", body: "Hai una nuova prenotazione ricorrente per {service} il {datetime}. Il cliente vuole pulizie regolari." },
    nl: { title: "Nieuwe terugkerende boeking!", body: "Je hebt een nieuwe terugkerende boeking voor {service} op {datetime}. De klant wil regelmatige schoonmaak." },
    pl: { title: "Nowa cykliczna rezerwacja!", body: "Masz nową cykliczną rezerwację na {service} w dniu {datetime}. Klient chce regularnego sprzątania." },
    pt: { title: "Nova reserva recorrente!", body: "Tens uma nova reserva recorrente de {service} em {datetime}. O cliente quer limpeza regular." },
  },
  // Cleaner marked the job done → ask the client to confirm so payment is released (dual-confirm).
  client_confirm_request: {
    en: { title: "Confirm your cleaning is done", body: "Your cleaner marked the job complete. Please confirm to release payment." },
    de: { title: "Bestätige, dass deine Reinigung erledigt ist", body: "Deine Reinigungskraft hat den Auftrag als erledigt markiert. Bitte bestätige, um die Zahlung freizugeben." },
    fr: { title: "Confirmez que votre ménage est terminé", body: "Votre intervenant a marqué la mission comme terminée. Veuillez confirmer pour libérer le paiement." },
    es: { title: "Confirma que tu limpieza está hecha", body: "Tu profesional marcó el trabajo como completado. Confirma para liberar el pago." },
    it: { title: "Conferma che la pulizia è stata completata", body: "Il tuo addetto ha contrassegnato il lavoro come completato. Conferma per rilasciare il pagamento." },
    nl: { title: "Bevestig dat je schoonmaak klaar is", body: "Je schoonmaker heeft de klus als voltooid gemarkeerd. Bevestig om de betaling vrij te geven." },
    pl: { title: "Potwierdź, że sprzątanie zostało wykonane", body: "Twoja osoba sprzątająca oznaczyła zlecenie jako wykonane. Potwierdź, aby zwolnić płatność." },
    pt: { title: "Confirme que a sua limpeza está concluída", body: "O seu profissional marcou o trabalho como concluído. Confirme para libertar o pagamento." },
  },
  // Time-agnostic CLEANER reminder ({datetime} carries day-before vs same-day). Provider perspective.
  booking_reminder_provider: {
    en: { title: "Upcoming cleaning job", body: "You have a cleaning job at {datetime}." },
    de: { title: "Bevorstehender Reinigungsauftrag", body: "Du hast einen Reinigungsauftrag am {datetime}." },
    fr: { title: "Mission de nettoyage à venir", body: "Vous avez une mission de nettoyage le {datetime}." },
    es: { title: "Trabajo de limpieza próximo", body: "Tienes un trabajo de limpieza el {datetime}." },
    it: { title: "Lavoro di pulizia in arrivo", body: "Hai un lavoro di pulizia il {datetime}." },
    nl: { title: "Aankomende schoonmaakklus", body: "Je hebt een schoonmaakklus op {datetime}." },
    pl: { title: "Nadchodzące zlecenie sprzątania", body: "Masz zlecenie sprzątania w dniu {datetime}." },
    pt: { title: "Trabalho de limpeza a chegar", body: "Tens um trabalho de limpeza em {datetime}." },
  },
  // Job is overdue — cleaner perspective (a 5%/day late fee applies until marked done).
  booking_overdue_cleaner: {
    en: { title: "Your job is overdue", body: "Your cleaning job on {datetime} is overdue. Please complete it as soon as possible — a 5%/day late fee applies until it is marked done." },
    de: { title: "Dein Auftrag ist überfällig", body: "Dein Reinigungsauftrag am {datetime} ist überfällig. Bitte schließe ihn so schnell wie möglich ab — es fällt eine Gebühr von 5 % pro Tag an, bis er als erledigt markiert ist." },
    fr: { title: "Votre mission est en retard", body: "Votre mission de nettoyage du {datetime} est en retard. Veuillez la terminer dès que possible — des frais de retard de 5 %/jour s'appliquent jusqu'à ce qu'elle soit marquée comme terminée." },
    es: { title: "Tu trabajo está atrasado", body: "Tu trabajo de limpieza del {datetime} está atrasado. Complétalo lo antes posible — se aplica un recargo del 5 %/día hasta que se marque como completado." },
    it: { title: "Il tuo lavoro è in ritardo", body: "Il tuo lavoro di pulizia del {datetime} è in ritardo. Completalo il prima possibile — si applica una penale del 5%/giorno finché non viene contrassegnato come completato." },
    nl: { title: "Je klus is te laat", body: "Je schoonmaakklus op {datetime} is te laat. Rond hem zo snel mogelijk af — er geldt een boete van 5%/dag totdat hij als voltooid is gemarkeerd." },
    pl: { title: "Twoje zlecenie jest zaległe", body: "Twoje zlecenie sprzątania z {datetime} jest zaległe. Wykonaj je jak najszybciej — naliczana jest opłata 5%/dzień, dopóki nie zostanie oznaczone jako wykonane." },
    pt: { title: "O teu trabalho está em atraso", body: "O teu trabalho de limpeza de {datetime} está em atraso. Conclui-o o mais rápido possível — aplica-se uma taxa de 5%/dia até ser marcado como concluído." },
  },
  // Job is overdue — client perspective.
  booking_overdue_client: {
    en: { title: "Your cleaning is overdue", body: "Your cleaner hasn't completed the job scheduled for {datetime} yet. We're following up with them." },
    de: { title: "Deine Reinigung ist überfällig", body: "Deine Reinigungskraft hat den für {datetime} geplanten Auftrag noch nicht abgeschlossen. Wir haken bei ihr nach." },
    fr: { title: "Votre ménage est en retard", body: "Votre intervenant n'a pas encore terminé la mission prévue le {datetime}. Nous le relançons." },
    es: { title: "Tu limpieza está atrasada", body: "Tu profesional aún no ha completado el trabajo programado para el {datetime}. Estamos haciéndole seguimiento." },
    it: { title: "La tua pulizia è in ritardo", body: "Il tuo addetto non ha ancora completato il lavoro previsto per il {datetime}. Lo stiamo sollecitando." },
    nl: { title: "Je schoonmaak is te laat", body: "Je schoonmaker heeft de klus van {datetime} nog niet afgerond. We nemen contact met hen op." },
    pl: { title: "Twoje sprzątanie jest zaległe", body: "Twoja osoba sprzątająca nie ukończyła jeszcze zlecenia zaplanowanego na {datetime}. Kontaktujemy się z nią." },
    pt: { title: "A tua limpeza está em atraso", body: "O teu profissional ainda não concluiu o trabalho agendado para {datetime}. Estamos a contactá-lo." },
  },
  // Overdue booking auto-reassigned to another cleaner — client perspective.
  booking_reassigned_client: {
    en: { title: "Booking reassigned", body: "Your overdue booking has been reassigned to another available cleaner. Check your new booking for the details." },
    de: { title: "Buchung neu zugewiesen", body: "Deine überfällige Buchung wurde einer anderen verfügbaren Reinigungskraft zugewiesen. Details findest du in deiner neuen Buchung." },
    fr: { title: "Réservation réattribuée", body: "Votre réservation en retard a été réattribuée à un autre intervenant disponible. Consultez votre nouvelle réservation pour les détails." },
    es: { title: "Reserva reasignada", body: "Tu reserva atrasada se ha reasignado a otro profesional disponible. Consulta tu nueva reserva para ver los detalles." },
    it: { title: "Prenotazione riassegnata", body: "La tua prenotazione in ritardo è stata riassegnata a un altro addetto disponibile. Controlla la nuova prenotazione per i dettagli." },
    nl: { title: "Boeking opnieuw toegewezen", body: "Je te late boeking is opnieuw toegewezen aan een andere beschikbare schoonmaker. Bekijk je nieuwe boeking voor de details." },
    pl: { title: "Rezerwacja przypisana ponownie", body: "Twoja zaległa rezerwacja została przypisana innej dostępnej osobie sprzątającej. Szczegóły znajdziesz w nowej rezerwacji." },
    pt: { title: "Reserva reatribuída", body: "A tua reserva em atraso foi reatribuída a outro profissional disponível. Consulta a tua nova reserva para os detalhes." },
  },
  // Overdue booking removed from the original cleaner and reassigned — cleaner perspective.
  booking_reassigned_away: {
    en: { title: "Booking removed", body: "An overdue booking was removed from your schedule and reassigned to another cleaner." },
    de: { title: "Buchung entfernt", body: "Eine überfällige Buchung wurde aus deinem Kalender entfernt und einer anderen Reinigungskraft zugewiesen." },
    fr: { title: "Réservation retirée", body: "Une réservation en retard a été retirée de votre planning et réattribuée à un autre intervenant." },
    es: { title: "Reserva eliminada", body: "Se eliminó de tu agenda una reserva atrasada y se reasignó a otro profesional." },
    it: { title: "Prenotazione rimossa", body: "Una prenotazione in ritardo è stata rimossa dal tuo calendario e riassegnata a un altro addetto." },
    nl: { title: "Boeking verwijderd", body: "Een te late boeking is uit je agenda verwijderd en aan een andere schoonmaker toegewezen." },
    pl: { title: "Rezerwacja usunięta", body: "Zaległa rezerwacja została usunięta z Twojego harmonogramu i przypisana innej osobie sprzątającej." },
    pt: { title: "Reserva removida", body: "Uma reserva em atraso foi removida do teu calendário e reatribuída a outro profissional." },
  },
  // Cleaner counter-offered on a booking (new time and/or rate) — client should review.
  booking_proposal: {
    en: { title: "Your cleaner suggests changes", body: "Your cleaner suggested changes to your booking. Review and accept or decline." },
    de: { title: "Deine Reinigungskraft schlägt Änderungen vor", body: "Deine Reinigungskraft hat Änderungen an deiner Buchung vorgeschlagen. Prüfe sie und nimm an oder lehne ab." },
    fr: { title: "Votre intervenant propose des modifications", body: "Votre intervenant a proposé des modifications à votre réservation. Consultez-les et acceptez ou refusez." },
    es: { title: "Tu profesional sugiere cambios", body: "Tu profesional ha sugerido cambios en tu reserva. Revísalos y acepta o rechaza." },
    it: { title: "Il tuo addetto suggerisce modifiche", body: "Il tuo addetto ha suggerito modifiche alla prenotazione. Controlla e accetta o rifiuta." },
    nl: { title: "Je schoonmaker stelt wijzigingen voor", body: "Je schoonmaker heeft wijzigingen aan je boeking voorgesteld. Bekijk ze en accepteer of wijs af." },
    pl: { title: "Osoba sprzątająca proponuje zmiany", body: "Osoba sprzątająca zaproponowała zmiany w rezerwacji. Sprawdź i zaakceptuj lub odrzuć." },
    pt: { title: "O teu profissional sugere alterações", body: "O teu profissional sugeriu alterações à tua reserva. Analisa e aceita ou recusa." },
  },
  proposal_accepted: {
    en: { title: "Suggestion accepted", body: "The client accepted your suggested changes — the booking has been updated." },
    de: { title: "Vorschlag angenommen", body: "Der Kunde hat deine vorgeschlagenen Änderungen angenommen — die Buchung wurde aktualisiert." },
    fr: { title: "Proposition acceptée", body: "Le client a accepté vos modifications — la réservation a été mise à jour." },
    es: { title: "Sugerencia aceptada", body: "El cliente aceptó tus cambios sugeridos: la reserva se ha actualizado." },
    it: { title: "Proposta accettata", body: "Il cliente ha accettato le modifiche suggerite — la prenotazione è stata aggiornata." },
    nl: { title: "Voorstel geaccepteerd", body: "De klant heeft je voorgestelde wijzigingen geaccepteerd — de boeking is bijgewerkt." },
    pl: { title: "Propozycja przyjęta", body: "Klient zaakceptował zaproponowane zmiany — rezerwacja została zaktualizowana." },
    pt: { title: "Sugestão aceite", body: "O cliente aceitou as tuas alterações — a reserva foi atualizada." },
  },
  proposal_declined: {
    en: { title: "Suggestion declined", body: "The client declined your suggested changes — the booking stays as originally agreed." },
    de: { title: "Vorschlag abgelehnt", body: "Der Kunde hat deine vorgeschlagenen Änderungen abgelehnt — die Buchung bleibt wie vereinbart." },
    fr: { title: "Proposition refusée", body: "Le client a refusé vos modifications — la réservation reste comme convenu." },
    es: { title: "Sugerencia rechazada", body: "El cliente rechazó tus cambios: la reserva se mantiene como se acordó." },
    it: { title: "Proposta rifiutata", body: "Il cliente ha rifiutato le modifiche — la prenotazione resta come concordato." },
    nl: { title: "Voorstel afgewezen", body: "De klant heeft je voorstel afgewezen — de boeking blijft zoals afgesproken." },
    pl: { title: "Propozycja odrzucona", body: "Klient odrzucił zmiany — rezerwacja pozostaje bez zmian." },
    pt: { title: "Sugestão recusada", body: "O cliente recusou as alterações — a reserva mantém-se como combinado." },
  },
  // Client booked WITHOUT adding a card — the cleaner must NOT take the order until one is added.
  booking_no_card: {
    en: { title: "No payment method on file — don't accept yet", body: "This client booked without adding a payment method. Ask them in the chat to add it — you can take the order once it's added, and payment is then collected automatically after you both confirm completion." },
    de: { title: "Keine Zahlungsmethode hinterlegt — noch nicht annehmen", body: "Dieser Kunde hat ohne Zahlungsmethode gebucht. Bitte ihn im Chat, eine hinzuzufügen — nimm den Auftrag erst danach an. Die Zahlung wird dann nach beidseitiger Bestätigung automatisch eingezogen." },
    fr: { title: "Aucun moyen de paiement — n'acceptez pas encore", body: "Ce client a réservé sans moyen de paiement. Demandez-lui dans la discussion d'en ajouter un — acceptez la mission seulement ensuite. Le paiement sera alors prélevé automatiquement après votre double confirmation." },
    es: { title: "Sin método de pago: no aceptes todavía", body: "Este cliente reservó sin método de pago. Pídele en el chat que añada uno; acepta el trabajo solo después. El pago se cobrará automáticamente tras la confirmación de ambos." },
    it: { title: "Nessun metodo di pagamento — non accettare ancora", body: "Questo cliente ha prenotato senza metodo di pagamento. Chiedigli in chat di aggiungerne uno — accetta il lavoro solo dopo. Il pagamento verrà poi addebitato automaticamente dopo la conferma di entrambi." },
    nl: { title: "Geen betaalmethode — accepteer nog niet", body: "Deze klant boekte zonder betaalmethode. Vraag in de chat om er een toe te voegen — neem de opdracht pas daarna aan. De betaling wordt dan automatisch geïnd nadat jullie beiden bevestigen." },
    pl: { title: "Brak metody płatności — nie przyjmuj jeszcze", body: "Ten klient zarezerwował bez metody płatności. Poproś na czacie o jej dodanie — przyjmij zlecenie dopiero potem. Płatność zostanie pobrana automatycznie po potwierdzeniu przez oboje." },
    pt: { title: "Sem método de pagamento — não aceites ainda", body: "Este cliente reservou sem método de pagamento. Pede no chat que adicione um — aceita o trabalho só depois. O pagamento será cobrado automaticamente após a confirmação de ambos." },
  },
  // Cleaner ACCEPTED the booking — includes the payment-method reassurance for the client.
  booking_accepted_by_cleaner: {
    en: { title: "Your booking has been confirmed!", body: "Your cleaner accepted your booking. Reminder: cleaners only accept orders from clients with a payment method on file — adding one never deducts anything before the work is done and you both confirm completion." },
    de: { title: "Deine Buchung wurde bestätigt!", body: "Deine Reinigungskraft hat die Buchung angenommen. Zur Erinnerung: Reinigungskräfte nehmen nur Aufträge von Kunden mit hinterlegter Zahlungsmethode an — dabei wird nichts abgebucht, bevor die Arbeit erledigt ist und ihr beide bestätigt." },
    fr: { title: "Votre réservation est confirmée !", body: "Votre intervenant a accepté la réservation. Rappel : les intervenants n'acceptent que les commandes de clients ayant un moyen de paiement enregistré — l'ajouter ne débite rien avant la fin du travail et votre double confirmation." },
    es: { title: "¡Tu reserva está confirmada!", body: "Tu profesional aceptó la reserva. Recuerda: los profesionales solo aceptan pedidos de clientes con método de pago registrado; añadirlo no descuenta nada antes de terminar el trabajo y de que ambos confirméis." },
    it: { title: "La tua prenotazione è confermata!", body: "Il tuo addetto ha accettato la prenotazione. Promemoria: gli addetti accettano solo ordini da clienti con un metodo di pagamento registrato — aggiungerlo non addebita nulla prima che il lavoro sia finito e che entrambi confermiate." },
    nl: { title: "Je boeking is bevestigd!", body: "Je schoonmaker heeft de boeking geaccepteerd. Ter herinnering: schoonmakers nemen alleen opdrachten aan van klanten met een betaalmethode — toevoegen ervan schrijft niets af vóór het werk klaar is en jullie beiden bevestigen." },
    pl: { title: "Twoja rezerwacja została potwierdzona!", body: "Osoba sprzątająca przyjęła rezerwację. Przypomnienie: przyjmowane są tylko zlecenia klientów z metodą płatności — jej dodanie niczego nie pobiera przed wykonaniem pracy i potwierdzeniem przez oboje." },
    pt: { title: "A tua reserva foi confirmada!", body: "O teu profissional aceitou a reserva. Lembrete: os profissionais só aceitam pedidos de clientes com método de pagamento registado — adicioná-lo não desconta nada antes de o trabalho estar feito e de ambos confirmarem." },
  },
  // No-card booking created — prompt the CLIENT to add a payment method (nothing charged upfront).
  client_add_payment_prompt: {
    en: { title: "Add a payment method so your cleaner can accept", body: "Cleaners only accept orders from clients with a payment method on file. Adding one does NOT charge you — payment is only collected after the work is done and you both confirm." },
    de: { title: "Füge eine Zahlungsmethode hinzu, damit deine Reinigungskraft annehmen kann", body: "Reinigungskräfte nehmen nur Aufträge von Kunden mit hinterlegter Zahlungsmethode an. Das Hinzufügen kostet nichts — bezahlt wird erst, wenn die Arbeit erledigt ist und ihr beide bestätigt." },
    fr: { title: "Ajoutez un moyen de paiement pour que votre intervenant accepte", body: "Les intervenants n'acceptent que les commandes de clients avec un moyen de paiement enregistré. L'ajouter ne vous débite pas — le paiement n'est prélevé qu'après la fin du travail et votre double confirmation." },
    es: { title: "Añade un método de pago para que tu profesional pueda aceptar", body: "Los profesionales solo aceptan pedidos de clientes con método de pago registrado. Añadirlo NO te cobra nada: el pago solo se realiza tras terminar el trabajo y confirmar ambos." },
    it: { title: "Aggiungi un metodo di pagamento così il tuo addetto può accettare", body: "Gli addetti accettano solo ordini da clienti con un metodo di pagamento registrato. Aggiungerlo NON ti addebita nulla — il pagamento avviene solo a lavoro finito e dopo la conferma di entrambi." },
    nl: { title: "Voeg een betaalmethode toe zodat je schoonmaker kan accepteren", body: "Schoonmakers nemen alleen opdrachten aan van klanten met een betaalmethode. Toevoegen kost niets — er wordt pas betaald nadat het werk klaar is en jullie beiden bevestigen." },
    pl: { title: "Dodaj metodę płatności, aby osoba sprzątająca mogła przyjąć zlecenie", body: "Przyjmowane są tylko zlecenia klientów z metodą płatności. Jej dodanie NIC nie kosztuje — płatność następuje dopiero po wykonaniu pracy i potwierdzeniu przez oboje." },
    pt: { title: "Adiciona um método de pagamento para o teu profissional poder aceitar", body: "Os profissionais só aceitam pedidos de clientes com método de pagamento registado. Adicioná-lo NÃO cobra nada — o pagamento só acontece depois de o trabalho estar feito e de ambos confirmarem." },
  },
  // Client added their payment method to a pending booking — the cleaner can now take the order.
  client_added_payment: {
    en: { title: "Payment method added", body: "The client added their payment method — payment is secured and will be collected automatically after you both confirm completion. You can take the order." },
    de: { title: "Zahlungsmethode hinzugefügt", body: "Der Kunde hat seine Zahlungsmethode hinzugefügt — die Zahlung ist gesichert und wird nach beidseitiger Bestätigung automatisch eingezogen. Du kannst den Auftrag annehmen." },
    fr: { title: "Moyen de paiement ajouté", body: "Le client a ajouté son moyen de paiement — le paiement est sécurisé et sera prélevé automatiquement après votre double confirmation. Vous pouvez accepter la mission." },
    es: { title: "Método de pago añadido", body: "El cliente añadió su método de pago: el pago está asegurado y se cobrará automáticamente tras la confirmación de ambos. Ya puedes aceptar el trabajo." },
    it: { title: "Metodo di pagamento aggiunto", body: "Il cliente ha aggiunto il metodo di pagamento — il pagamento è garantito e verrà addebitato automaticamente dopo la conferma di entrambi. Puoi accettare il lavoro." },
    nl: { title: "Betaalmethode toegevoegd", body: "De klant heeft een betaalmethode toegevoegd — de betaling is veiliggesteld en wordt automatisch geïnd nadat jullie beiden bevestigen. Je kunt de opdracht aannemen." },
    pl: { title: "Dodano metodę płatności", body: "Klient dodał metodę płatności — płatność jest zabezpieczona i zostanie pobrana automatycznie po potwierdzeniu przez oboje. Możesz przyjąć zlecenie." },
    pt: { title: "Método de pagamento adicionado", body: "O cliente adicionou o método de pagamento — o pagamento está garantido e será cobrado automaticamente após a confirmação de ambos. Podes aceitar o trabalho." },
  },
  // The DORIXÉ support team replied to the user's support thread. {message} = reply snippet.
  support_reply: {
    en: { title: "Support replied", body: "DORIXÉ support replied: {message}" },
    de: { title: "Support hat geantwortet", body: "Der DORIXÉ-Support hat geantwortet: {message}" },
    fr: { title: "Le support a répondu", body: "Le support DORIXÉ a répondu : {message}" },
    es: { title: "Soporte ha respondido", body: "El soporte de DORIXÉ respondió: {message}" },
    it: { title: "Il supporto ha risposto", body: "Il supporto DORIXÉ ha risposto: {message}" },
    nl: { title: "Support heeft geantwoord", body: "DORIXÉ-support heeft geantwoord: {message}" },
    pl: { title: "Wsparcie odpowiedziało", body: "Zespół DORIXÉ odpowiedział: {message}" },
    pt: { title: "O suporte respondeu", body: "O suporte da DORIXÉ respondeu: {message}" },
  },
  // A client tried to book a cleaner whose payout account isn't connected/active yet.
  payout_setup_needed: {
    en: { title: "A client tried to book you — finish your payout setup", body: "A client tried to book you, but you haven't connected your payout account yet. Connect it in Earnings so you can get booked and paid." },
    de: { title: "Ein Kunde wollte dich buchen — schließe deine Auszahlung ein", body: "Ein Kunde wollte dich buchen, aber dein Auszahlungskonto ist noch nicht verbunden. Verbinde es unter Einnahmen, damit du gebucht und bezahlt werden kannst." },
    fr: { title: "Un client a voulu vous réserver — finalisez vos paiements", body: "Un client a voulu vous réserver, mais votre compte de versement n'est pas encore connecté. Connectez-le dans Revenus pour pouvoir être réservé et payé." },
    es: { title: "Un cliente intentó reservarte: completa tu configuración de cobros", body: "Un cliente intentó reservarte, pero aún no has conectado tu cuenta de cobros. Conéctala en Ingresos para poder recibir reservas y pagos." },
    it: { title: "Un cliente ha provato a prenotarti — completa i pagamenti", body: "Un cliente ha provato a prenotarti, ma non hai ancora collegato il conto per i pagamenti. Collegalo in Guadagni per poter essere prenotato e pagato." },
    nl: { title: "Een klant wilde je boeken — voltooi je uitbetaling", body: "Een klant wilde je boeken, maar je uitbetalingsaccount is nog niet gekoppeld. Koppel het bij Inkomsten zodat je geboekt en betaald kunt worden." },
    pl: { title: "Klient próbował Cię zarezerwować — dokończ konfigurację wypłat", body: "Klient próbował Cię zarezerwować, ale nie połączyłeś jeszcze konta wypłat. Połącz je w Zarobkach, aby można było Cię rezerwować i płacić." },
    pt: { title: "Um cliente tentou reservar-te — conclui a configuração de pagamentos", body: "Um cliente tentou reservar-te, mas ainda não ligaste a tua conta de pagamentos. Liga-a em Ganhos para poderes ser reservado e pago." },
  },
  // A job this cleaner bid on was assigned to someone else — encourage them to keep bidding.
  bid_lost_assigned: {
    en: { title: "Job assigned to another cleaner", body: "“{title}” was assigned to another cleaner. Don't stop — new jobs are posted all the time. Keep bidding!" },
    de: { title: "Auftrag an andere Reinigungskraft vergeben", body: "„{title}“ wurde an eine andere Reinigungskraft vergeben. Nicht aufgeben — es werden laufend neue Aufträge eingestellt. Biete weiter mit!" },
    fr: { title: "Mission attribuée à un autre intervenant", body: "« {title} » a été attribuée à un autre intervenant. Ne lâchez rien — de nouvelles missions sont publiées en permanence. Continuez à proposer vos offres !" },
    es: { title: "Trabajo asignado a otro profesional", body: "«{title}» se asignó a otro profesional. No te detengas: se publican trabajos nuevos constantemente. ¡Sigue enviando ofertas!" },
    it: { title: "Lavoro assegnato a un altro addetto", body: "“{title}” è stato assegnato a un altro addetto. Non fermarti — nuovi lavori vengono pubblicati di continuo. Continua a fare offerte!" },
    nl: { title: "Klus aan een andere schoonmaker toegewezen", body: "“{title}” is aan een andere schoonmaker toegewezen. Geef niet op — er worden voortdurend nieuwe klussen geplaatst. Blijf bieden!" },
    pl: { title: "Zlecenie przydzielone innej osobie", body: "„{title}” przydzielono innej osobie sprzątającej. Nie poddawaj się — nowe zlecenia pojawiają się cały czas. Licytuj dalej!" },
    pt: { title: "Trabalho atribuído a outro profissional", body: "“{title}” foi atribuído a outro profissional. Não pares — são publicados novos trabalhos a toda a hora. Continua a enviar propostas!" },
  },
  // Cleaner rejected a fresh booking with a stated reason; the hold was fully released.
  booking_rejected: {
    en: { title: "Booking declined", body: "Your cleaner can't take the booking scheduled for {datetime}. Reason: {reason}. Your payment hold was fully released." },
    de: { title: "Buchung abgelehnt", body: "Deine Reinigungskraft kann die Buchung am {datetime} nicht übernehmen. Grund: {reason}. Deine Zahlungsreservierung wurde vollständig freigegeben." },
    fr: { title: "Réservation refusée", body: "Votre intervenant ne peut pas assurer la réservation du {datetime}. Motif : {reason}. Votre empreinte bancaire a été entièrement libérée." },
    es: { title: "Reserva rechazada", body: "Tu profesional no puede atender la reserva del {datetime}. Motivo: {reason}. La retención del pago se liberó por completo." },
    it: { title: "Prenotazione rifiutata", body: "Il tuo addetto non può accettare la prenotazione del {datetime}. Motivo: {reason}. Il blocco sul pagamento è stato rilasciato." },
    nl: { title: "Boeking geweigerd", body: "Je schoonmaker kan de boeking van {datetime} niet aannemen. Reden: {reason}. De reservering op je betaling is volledig vrijgegeven." },
    pl: { title: "Rezerwacja odrzucona", body: "Osoba sprzątająca nie może przyjąć rezerwacji z {datetime}. Powód: {reason}. Blokada płatności została w pełni zwolniona." },
    pt: { title: "Reserva recusada", body: "O teu profissional não pode aceitar a reserva de {datetime}. Motivo: {reason}. A retenção do pagamento foi totalmente libertada." },
  },
}

// Placeholders each type's strings expect. A type localizes only if metadata supplies all of them.
const PARAMS: Record<string, string[]> = {
  new_job_request: ["category", "city", "distance"],
  bid_received: ["name", "amount", "message"],
  bid_accepted: ["amount"],
  booking_reminder: ["datetime"],
  dispute_opened: ["reason"],
  dispute_resolved: ["resolution"],
  new_message: ["message"],
  recurring_booking_created: ["datetime"],
  recurring_payment_failed: ["datetime"],
  recurring_skipped: [],
  booking_reminder_client: ["datetime"],
  booking_cancelled_party: ["datetime"],
  new_booking_provider: ["service", "datetime"],
  new_booking_provider_recurring: ["service", "datetime"],
  client_confirm_request: [],
  booking_reminder_provider: ["datetime"],
  booking_overdue_cleaner: ["datetime"],
  booking_overdue_client: ["datetime"],
  booking_rejected: ["datetime", "reason"],
  support_reply: ["message"],
  bid_lost_assigned: ["title"],
}

/**
 * Localize a notification into the viewer's UI locale. Static types localize unconditionally; dynamic
 * types localize only when `metadata` supplies all their placeholders — otherwise the stored
 * (English) title/body is returned so a {placeholder} never renders empty. Unknown types fall back too.
 */
export function localizeNotification(
  type: string,
  locale: string | null | undefined,
  metadata: Record<string, string> | null | undefined,
  fallbackTitle: string,
  fallbackBody: string,
): { title: string; body: string } {
  // A `variant` in metadata overrides the copy key, letting one DB enum value (e.g.
  // recurring_booking_created) localize to the correct message for the actual event. Only honour
  // a variant we actually have copy for; otherwise fall back to the type's own copy.
  const variant = metadata?.variant
  const key = variant && NOTIF[variant] ? variant : type
  const byType = NOTIF[key]
  if (!byType) return { title: fallbackTitle, body: fallbackBody }
  const lc = isLocale(locale) ? locale : defaultLocale
  const s = byType[lc] ?? byType[defaultLocale]
  if (!s) return { title: fallbackTitle, body: fallbackBody }
  const needed = PARAMS[key] ?? []
  if (needed.some((p) => metadata?.[p] == null || metadata[p] === "")) {
    return { title: fallbackTitle, body: fallbackBody }
  }
  const fill = (str: string) => str.replace(/\{(\w+)\}/g, (_m, k) => String(metadata?.[k] ?? ""))
  return { title: fill(s.title), body: fill(s.body) }
}
