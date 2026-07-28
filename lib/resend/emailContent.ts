import { isLocale, defaultLocale } from "@/i18n/config"

// Localized copy for the transactional emails (welcome + cleaner-approval). The user's locale is the
// one detected at onboarding (IP country -> language) and stored on users.locale. Server-only; the
// HTML wrappers live here so the email markup stays with the email code. Falls back to English.

type Welcome = { subject: string; greeting: string; intro: string; popular: string; signoff: string; team: string }
type Approval = { subject: string; heading: string; greeting: string; body: string; button: string; footer: string }

const WELCOME: Record<string, Welcome> = {
  en: { subject: "Welcome to DORIXÉ 🌿", greeting: "Hi {name},", intro: "Welcome to DORIXÉ — eco-friendly home cleaning. Book identity-verified cleaners by the hour or job, set up recurring cleans with a loyalty discount, or post a job and get bids.", popular: "Popular right now: Regular Cleaning, Deep Cleaning, and Move-in / Move-out.", signoff: "Welcome aboard,", team: "The DORIXÉ team" },
  de: { subject: "Willkommen bei DORIXÉ 🌿", greeting: "Hallo {name},", intro: "Willkommen bei DORIXÉ – umweltfreundliche Haushaltsreinigung. Buchen Sie identitätsgeprüfte Reinigungskräfte nach Stunde oder Auftrag, richten Sie wiederkehrende Reinigungen mit Treuerabatt ein oder veröffentlichen Sie einen Auftrag und erhalten Sie Angebote.", popular: "Gerade beliebt: Standardreinigung, Grundreinigung und Ein-/Auszugsreinigung.", signoff: "Herzlich willkommen,", team: "Das DORIXÉ-Team" },
  fr: { subject: "Bienvenue chez DORIXÉ 🌿", greeting: "Bonjour {name},", intro: "Bienvenue chez DORIXÉ – le ménage écologique à domicile. Réservez des agents d'entretien à l'identité vérifiée à l'heure ou à la tâche, programmez des ménages réguliers avec une remise fidélité, ou publiez une annonce et recevez des offres.", popular: "Populaires en ce moment : Ménage régulier, Grand ménage et Entrée / Sortie de logement.", signoff: "Bienvenue parmi nous,", team: "L'équipe DORIXÉ" },
  es: { subject: "Te damos la bienvenida a DORIXÉ 🌿", greeting: "Hola {name}:", intro: "Te damos la bienvenida a DORIXÉ, la limpieza del hogar ecológica. Reserva personal de limpieza con identidad verificada por horas o por trabajo, programa limpiezas periódicas con descuento por fidelidad, o publica un trabajo y recibe ofertas.", popular: "Populares ahora mismo: Limpieza regular, Limpieza a fondo y Entrada / Salida de vivienda.", signoff: "Bienvenido/a a bordo,", team: "El equipo de DORIXÉ" },
  it: { subject: "Benvenuto su DORIXÉ 🌿", greeting: "Ciao {name},", intro: "Benvenuto su DORIXÉ, le pulizie domestiche ecologiche. Prenota addetti alle pulizie con identità verificata a ore o a lavoro, imposta pulizie ricorrenti con sconto fedeltà, oppure pubblica un annuncio e ricevi offerte.", popular: "Popolari in questo momento: Pulizia ordinaria, Pulizia profonda e Trasloco in entrata / uscita.", signoff: "Benvenuto a bordo,", team: "Il team DORIXÉ" },
  nl: { subject: "Welkom bij DORIXÉ 🌿", greeting: "Hoi {name},", intro: "Welkom bij DORIXÉ – milieuvriendelijke huishoudelijke schoonmaak. Boek schoonmakers met geverifieerde identiteit per uur of per klus, stel terugkerende schoonmaakbeurten in met loyaliteitskorting, of plaats een klus en ontvang biedingen.", popular: "Nu populair: Reguliere schoonmaak, Grote schoonmaak en In- / uitverhuisschoonmaak.", signoff: "Welkom aan boord,", team: "Het DORIXÉ-team" },
  pl: { subject: "Witamy w DORIXÉ 🌿", greeting: "Cześć {name},", intro: "Witamy w DORIXÉ – ekologiczne sprzątanie domu. Rezerwuj osoby sprzątające o zweryfikowanej tożsamości na godziny lub za zlecenie, ustaw cykliczne sprzątanie z rabatem lojalnościowym albo opublikuj zlecenie i zbieraj oferty.", popular: "Popularne teraz: Sprzątanie standardowe, Sprzątanie gruntowne oraz Sprzątanie po przeprowadzce.", signoff: "Witamy na pokładzie,", team: "Zespół DORIXÉ" },
  pt: { subject: "Bem-vindo à DORIXÉ 🌿", greeting: "Olá {name},", intro: "Bem-vindo à DORIXÉ – limpeza doméstica ecológica. Reserve profissionais de limpeza com identidade verificada à hora ou por serviço, agende limpezas recorrentes com desconto de fidelidade, ou publique um serviço e receba propostas.", popular: "Populares agora: Limpeza regular, Limpeza profunda e Mudança de entrada / saída.", signoff: "Boas-vindas,", team: "A equipa DORIXÉ" },
}

const APPROVAL: Record<string, Approval> = {
  en: { subject: "🎉 You're approved — welcome to DORIXÉ!", heading: "You're approved! 🎉", greeting: "Hi {name},", body: "Congratulations — your DORIXÉ cleaner account has been approved. You can now browse open jobs, place bids, and start earning.", button: "Go to your dashboard", footer: "Welcome to the DORIXÉ community — clean home, green future." },
  de: { subject: "🎉 Sie sind freigeschaltet – willkommen bei DORIXÉ!", heading: "Sie sind freigeschaltet! 🎉", greeting: "Hallo {name},", body: "Herzlichen Glückwunsch – Ihr DORIXÉ-Konto als Reinigungskraft wurde freigeschaltet. Sie können jetzt offene Aufträge durchsuchen, Angebote abgeben und mit dem Verdienen beginnen.", button: "Zum Dashboard", footer: "Willkommen in der DORIXÉ-Community – sauberes Zuhause, grüne Zukunft." },
  fr: { subject: "🎉 Vous êtes approuvé(e) – bienvenue chez DORIXÉ !", heading: "Vous êtes approuvé(e) ! 🎉", greeting: "Bonjour {name},", body: "Félicitations – votre compte agent d'entretien DORIXÉ a été approuvé. Vous pouvez désormais parcourir les annonces ouvertes, faire des offres et commencer à gagner de l'argent.", button: "Accéder à votre tableau de bord", footer: "Bienvenue dans la communauté DORIXÉ – maison propre, avenir vert." },
  es: { subject: "🎉 ¡Has sido aprobado/a! Te damos la bienvenida a DORIXÉ", heading: "¡Has sido aprobado/a! 🎉", greeting: "Hola {name}:", body: "Enhorabuena: tu cuenta de personal de limpieza de DORIXÉ ha sido aprobada. Ya puedes explorar trabajos disponibles, hacer ofertas y empezar a ganar dinero.", button: "Ir a tu panel", footer: "Bienvenido/a a la comunidad DORIXÉ: hogar limpio, futuro verde." },
  it: { subject: "🎉 Sei stato approvato – benvenuto su DORIXÉ!", heading: "Sei stato approvato! 🎉", greeting: "Ciao {name},", body: "Congratulazioni: il tuo account come addetto alle pulizie DORIXÉ è stato approvato. Ora puoi sfogliare i lavori disponibili, inviare offerte e iniziare a guadagnare.", button: "Vai alla tua dashboard", footer: "Benvenuto nella community DORIXÉ – casa pulita, futuro verde." },
  nl: { subject: "🎉 Je bent goedgekeurd – welkom bij DORIXÉ!", heading: "Je bent goedgekeurd! 🎉", greeting: "Hoi {name},", body: "Gefeliciteerd – je DORIXÉ-account als schoonmaker is goedgekeurd. Je kunt nu openstaande klussen bekijken, biedingen plaatsen en geld gaan verdienen.", button: "Ga naar je dashboard", footer: "Welkom bij de DORIXÉ-community – schoon huis, groene toekomst." },
  pl: { subject: "🎉 Zostałeś zatwierdzony – witamy w DORIXÉ!", heading: "Zostałeś zatwierdzony! 🎉", greeting: "Cześć {name},", body: "Gratulacje – Twoje konto osoby sprzątającej w DORIXÉ zostało zatwierdzone. Możesz teraz przeglądać dostępne zlecenia, składać oferty i zacząć zarabiać.", button: "Przejdź do panelu", footer: "Witamy w społeczności DORIXÉ – czysty dom, zielona przyszłość." },
  pt: { subject: "🎉 Você foi aprovado – bem-vindo à DORIXÉ!", heading: "Você foi aprovado! 🎉", greeting: "Olá {name},", body: "Parabéns – a sua conta de profissional de limpeza na DORIXÉ foi aprovada. Já pode procurar serviços disponíveis, enviar propostas e começar a ganhar.", button: "Aceder ao seu painel", footer: "Bem-vindo à comunidade DORIXÉ – casa limpa, futuro verde." },
}

type ReferralExplainer = { subject: string; heading: string; greeting: string; bodyIntro: string; bodyMechanics: string; bodyPayout: string; button: string }

// Sent once, right after the welcome email, explaining the referral programme — content branches
// by role since the reward mechanics genuinely differ: cleaners earn cash (auto-paid via Stripe),
// clients earn a spendable/withdrawable discount balance.
const REFERRAL_CLEANER: Record<string, ReferralExplainer> = {
  en: { subject: "How DORIXÉ referrals pay you 🌿", heading: "Turn your network into extra income", greeting: "Hi {name},", bodyIntro: "You have your own referral link on your dashboard. Share it with other cleaners or with clients.", bodyMechanics: "Invite a cleaner and earn a commission on their first 3 completed jobs. Invite a client and earn a commission on every booking they make, for as long as they book with DORIXÉ.", bodyPayout: "Commissions are credited to your balance automatically and paid out to your bank via Stripe at the start of every month — nothing to request.", button: "Find your referral link" },
  de: { subject: "So zahlt sich Ihre DORIXÉ-Empfehlung aus 🌿", heading: "Machen Sie aus Ihrem Netzwerk ein Zusatzeinkommen", greeting: "Hallo {name},", bodyIntro: "In Ihrem Dashboard finden Sie Ihren persönlichen Empfehlungslink. Teilen Sie ihn mit anderen Reinigungskräften oder mit Kund:innen.", bodyMechanics: "Empfehlen Sie eine Reinigungskraft und erhalten Sie eine Provision für deren erste 3 abgeschlossenen Aufträge. Empfehlen Sie eine:n Kund:in und erhalten Sie eine Provision auf jede Buchung, solange diese Person bei DORIXÉ bucht.", bodyPayout: "Provisionen werden automatisch Ihrem Guthaben gutgeschrieben und zu Beginn jedes Monats per Stripe auf Ihr Bankkonto ausgezahlt — Sie müssen nichts beantragen.", button: "Empfehlungslink anzeigen" },
  fr: { subject: "Comment le parrainage DORIXÉ vous rapporte 🌿", heading: "Transformez votre réseau en revenu supplémentaire", greeting: "Bonjour {name},", bodyIntro: "Vous disposez de votre propre lien de parrainage sur votre tableau de bord. Partagez-le avec d'autres intervenants ou avec des clients.", bodyMechanics: "Parrainez un intervenant et gagnez une commission sur ses 3 premières missions terminées. Parrainez un client et gagnez une commission sur chacune de ses réservations, tant qu'il réserve chez DORIXÉ.", bodyPayout: "Les commissions sont automatiquement créditées sur votre solde et versées sur votre compte bancaire via Stripe au début de chaque mois — rien à demander.", button: "Retrouver mon lien de parrainage" },
  es: { subject: "Así te paga el programa de referidos de DORIXÉ 🌿", heading: "Convierte tu red en ingresos extra", greeting: "Hola {name}:", bodyIntro: "Tienes tu propio enlace de referidos en tu panel. Compártelo con otros profesionales de limpieza o con clientes.", bodyMechanics: "Invita a un profesional de limpieza y gana una comisión por sus primeros 3 trabajos completados. Invita a un cliente y gana una comisión por cada reserva que haga, mientras siga reservando con DORIXÉ.", bodyPayout: "Las comisiones se acreditan automáticamente en tu saldo y se transfieren a tu banco por Stripe a principios de cada mes — no tienes que solicitar nada.", button: "Ver mi enlace de referidos" },
  it: { subject: "Come i referral DORIXÉ ti fanno guadagnare 🌿", heading: "Trasforma la tua rete in un guadagno extra", greeting: "Ciao {name},", bodyIntro: "Hai il tuo link referral personale nella dashboard. Condividilo con altri addetti alle pulizie o con i clienti.", bodyMechanics: "Invita un addetto e guadagna una commissione sui suoi primi 3 lavori completati. Invita un cliente e guadagna una commissione su ogni sua prenotazione, finché prenota con DORIXÉ.", bodyPayout: "Le commissioni vengono accreditate automaticamente sul tuo saldo e trasferite sul tuo conto bancario tramite Stripe all'inizio di ogni mese — non devi richiedere nulla.", button: "Trova il tuo link referral" },
  nl: { subject: "Zo betaalt DORIXÉ-verwijzen jou uit 🌿", heading: "Maak van je netwerk extra inkomen", greeting: "Hoi {name},", bodyIntro: "Je hebt je eigen verwijzingslink op je dashboard. Deel deze met andere schoonmakers of met klanten.", bodyMechanics: "Verwijs een schoonmaker en verdien commissie op hun eerste 3 voltooide klussen. Verwijs een klant en verdien commissie op elke boeking die ze maken, zolang ze bij DORIXÉ blijven boeken.", bodyPayout: "Commissies worden automatisch bijgeschreven op je saldo en aan het begin van elke maand via Stripe naar je bank overgemaakt — je hoeft niets aan te vragen.", button: "Bekijk je verwijzingslink" },
  pl: { subject: "Tak zarabiasz na poleceniach w DORIXÉ 🌿", heading: "Zamień swoją sieć kontaktów w dodatkowy dochód", greeting: "Cześć {name},", bodyIntro: "Masz własny link polecający w panelu. Udostępnij go innym osobom sprzątającym lub klientom.", bodyMechanics: "Poleć osobę sprzątającą i zarabiaj prowizję od jej pierwszych 3 ukończonych zleceń. Poleć klienta i zarabiaj prowizję od każdej jego rezerwacji, dopóki rezerwuje w DORIXÉ.", bodyPayout: "Prowizje są automatycznie naliczane na Twoje saldo i wypłacane na konto bankowe przez Stripe na początku każdego miesiąca — nie musisz o nic wnioskować.", button: "Znajdź swój link polecający" },
  pt: { subject: "Assim as indicações DORIXÉ lhe pagam 🌿", heading: "Transforme a sua rede em rendimento extra", greeting: "Olá {name},", bodyIntro: "Tem o seu próprio link de indicação no painel. Partilhe-o com outros profissionais de limpeza ou com clientes.", bodyMechanics: "Indique um profissional e ganhe comissão nos primeiros 3 trabalhos concluídos. Indique um cliente e ganhe comissão em cada reserva que fizer, enquanto reservar com a DORIXÉ.", bodyPayout: "As comissões são creditadas automaticamente no seu saldo e transferidas para o seu banco via Stripe no início de cada mês — não precisa de pedir nada.", button: "Ver o meu link de indicação" },
}

const REFERRAL_CLIENT: Record<string, ReferralExplainer> = {
  en: { subject: "Earn free cleaning credit by inviting friends 🌿", heading: "Invite friends, earn credit", greeting: "Hi {name},", bodyIntro: "You have your own referral link on your dashboard. Share it with friends or with cleaners.", bodyMechanics: "For every completed order from someone you invite — a friend's booking, or a cleaner's completed job — you earn a discount credited to your account.", bodyPayout: "Use your balance as a discount at checkout on your next booking, or withdraw it to your bank at any time.", button: "Find your referral link" },
  de: { subject: "Kostenloses Guthaben durch Weiterempfehlen sichern 🌿", heading: "Freunde einladen, Guthaben sichern", greeting: "Hallo {name},", bodyIntro: "In Ihrem Dashboard finden Sie Ihren persönlichen Empfehlungslink. Teilen Sie ihn mit Freund:innen oder mit Reinigungskräften.", bodyMechanics: "Für jede abgeschlossene Bestellung einer von Ihnen eingeladenen Person — eine Buchung eines Freundes oder ein abgeschlossener Auftrag einer Reinigungskraft — erhalten Sie einen Rabatt, der Ihrem Konto gutgeschrieben wird.", bodyPayout: "Nutzen Sie Ihr Guthaben als Rabatt bei Ihrer nächsten Buchung oder lassen Sie es sich jederzeit auf Ihr Bankkonto auszahlen.", button: "Empfehlungslink anzeigen" },
  fr: { subject: "Gagnez du crédit gratuit en invitant vos amis 🌿", heading: "Invitez vos amis, gagnez du crédit", greeting: "Bonjour {name},", bodyIntro: "Vous disposez de votre propre lien de parrainage sur votre tableau de bord. Partagez-le avec des amis ou avec des intervenants.", bodyMechanics: "Pour chaque commande terminée par une personne que vous invitez — la réservation d'un ami, ou la mission terminée d'un intervenant — vous gagnez une réduction créditée sur votre compte.", bodyPayout: "Utilisez votre solde comme réduction lors de votre prochaine réservation, ou retirez-le vers votre banque à tout moment.", button: "Retrouver mon lien de parrainage" },
  es: { subject: "Gana crédito gratis invitando a tus amigos 🌿", heading: "Invita a tus amigos, gana crédito", greeting: "Hola {name}:", bodyIntro: "Tienes tu propio enlace de referidos en tu panel. Compártelo con amigos o con profesionales de limpieza.", bodyMechanics: "Por cada pedido completado de alguien que invites —la reserva de un amigo, o el trabajo completado de un profesional— ganas un descuento que se acredita en tu cuenta.", bodyPayout: "Usa tu saldo como descuento en tu próxima reserva, o retíralo a tu banco cuando quieras.", button: "Ver mi enlace de referidos" },
  it: { subject: "Guadagna credito gratuito invitando i tuoi amici 🌿", heading: "Invita amici, guadagna credito", greeting: "Ciao {name},", bodyIntro: "Hai il tuo link referral personale nella dashboard. Condividilo con amici o con addetti alle pulizie.", bodyMechanics: "Per ogni ordine completato da una persona che inviti — la prenotazione di un amico, o il lavoro completato di un addetto — guadagni uno sconto accreditato sul tuo account.", bodyPayout: "Usa il tuo saldo come sconto sulla tua prossima prenotazione, oppure prelevalo sul tuo conto bancario quando vuoi.", button: "Trova il tuo link referral" },
  nl: { subject: "Verdien gratis tegoed door vrienden uit te nodigen 🌿", heading: "Nodig vrienden uit, verdien tegoed", greeting: "Hoi {name},", bodyIntro: "Je hebt je eigen verwijzingslink op je dashboard. Deel deze met vrienden of met schoonmakers.", bodyMechanics: "Voor elke voltooide bestelling van iemand die je uitnodigt — de boeking van een vriend, of de voltooide klus van een schoonmaker — verdien je een korting die op je account wordt bijgeschreven.", bodyPayout: "Gebruik je saldo als korting bij je volgende boeking, of neem het op naar je bank wanneer je maar wilt.", button: "Bekijk je verwijzingslink" },
  pl: { subject: "Zdobądź darmowe środki, polecając znajomych 🌿", heading: "Polecaj znajomych, zdobywaj środki", greeting: "Cześć {name},", bodyIntro: "Masz własny link polecający w panelu. Udostępnij go znajomym lub osobom sprzątającym.", bodyMechanics: "Za każde ukończone zamówienie osoby, którą polecisz — rezerwację znajomego lub ukończone zlecenie osoby sprzątającej — otrzymujesz zniżkę zaliczaną na Twoje konto.", bodyPayout: "Wykorzystaj swoje saldo jako zniżkę przy następnej rezerwacji lub wypłać je na konto bankowe w dowolnym momencie.", button: "Znajdź swój link polecający" },
  pt: { subject: "Ganhe crédito grátis ao convidar amigos 🌿", heading: "Convide amigos, ganhe crédito", greeting: "Olá {name},", bodyIntro: "Tem o seu próprio link de indicação no painel. Partilhe-o com amigos ou com profissionais de limpeza.", bodyMechanics: "Por cada encomenda concluída de alguém que convidar — a reserva de um amigo, ou o trabalho concluído de um profissional — ganha um desconto creditado na sua conta.", bodyPayout: "Use o seu saldo como desconto na sua próxima reserva, ou levante-o para o seu banco a qualquer momento.", button: "Ver o meu link de indicação" },
}

function loc(locale: string | null | undefined): string {
  return isLocale(locale) ? locale : defaultLocale
}

// Sent once, right after the welcome email (both roles) — explains the referral programme, how
// rewards are earned, and (branching by role) how they're paid out or spent.
export function referralExplainerEmail(locale: string | null | undefined, firstName: string | null, isCleanerRole: boolean, dashboardUrl: string): { subject: string; html: string } {
  const table = isCleanerRole ? REFERRAL_CLEANER : REFERRAL_CLIENT
  const s = table[loc(locale)] ?? table[defaultLocale]
  const name = firstName?.trim()
  const greeting = name ? `<p style="margin:0 0 12px;">${s.greeting.replace("{name}", name)}</p>` : ""
  const html = `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;">${s.heading}</h1>
      ${greeting}
      <p style="margin:0 0 14px;">${s.bodyIntro}</p>
      <p style="margin:0 0 14px;">${s.bodyMechanics}</p>
      <p style="margin:0 0 16px;">${s.bodyPayout}</p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#2D7A5F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;">${s.button}</a>
    </div>
  </div></body></html>`
  return { subject: s.subject, html }
}

// Welcome email BODY (sendMarketingEmail wraps it in the branded shell + unsubscribe footer).
export function welcomeEmail(locale: string | null | undefined, firstName: string | null): { subject: string; html: string } {
  const s = WELCOME[loc(locale)] ?? WELCOME[defaultLocale]
  const name = firstName?.trim()
  const greeting = name ? `<p>${s.greeting.replace("{name}", name)}</p>` : ""
  return { subject: s.subject, html: `${greeting}<p>${s.intro}</p><p>${s.popular}</p><p>${s.signoff}<br/>${s.team}</p>` }
}

// Cleaner-approval email — full branded HTML (sent directly via Resend, transactional, no unsubscribe).
export function approvalEmail(locale: string | null | undefined, firstName: string | null, dashboardUrl: string): { subject: string; html: string } {
  const s = APPROVAL[loc(locale)] ?? APPROVAL[defaultLocale]
  const name = firstName?.trim()
  const greeting = name ? `<p style="margin:0 0 12px;">${s.greeting.replace("{name}", name)}</p>` : ""
  const html = `<!doctype html><html><body style="margin:0;background:#F4FAF6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2B3441;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#2B3441;">DORIXÉ</span>
      <span style="font-size:10px;letter-spacing:1.5px;color:#2D7A5F;font-weight:700;"> · CLEAN HOME. GREEN FUTURE.</span>
    </div>
    <div style="background:#ffffff;border:1px solid #E5EBF0;border-radius:16px;padding:28px;line-height:1.6;font-size:15px;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px;">${s.heading}</h1>
      ${greeting}
      <p style="margin:0 0 16px;">${s.body}</p>
      <a href="${dashboardUrl}" style="display:inline-block;background:#2D7A5F;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;">${s.button}</a>
      <p style="margin:18px 0 0;color:#6B7280;font-size:13px;">${s.footer}</p>
    </div>
  </div></body></html>`
  return { subject: s.subject, html }
}
