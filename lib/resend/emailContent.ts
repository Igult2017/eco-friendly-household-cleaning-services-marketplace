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

function loc(locale: string | null | undefined): string {
  return isLocale(locale) ? locale : defaultLocale
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
