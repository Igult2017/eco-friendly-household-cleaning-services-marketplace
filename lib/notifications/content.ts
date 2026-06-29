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
  client_confirm_request: [],
  booking_reminder_provider: ["datetime"],
  booking_overdue_cleaner: ["datetime"],
  booking_overdue_client: ["datetime"],
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
