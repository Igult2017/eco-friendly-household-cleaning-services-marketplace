import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Impressum — DORIXÉ",
}

export default function ImpressumPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="font-serif text-4xl font-bold text-[#2B3441] mb-2">Impressum</h1>
      <p className="text-[#6B7280] text-sm mb-8">Legal Notice (§ 5 TMG)</p>

      <div className="space-y-6 text-sm text-[#2B3441]/80 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Angaben gemäß § 5 TMG</h2>
          <p>
            DORIXÉ Marketplace UG (haftungsbeschränkt)<br />
            Musterstraße 1<br />
            10115 Berlin<br />
            Deutschland
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Kontakt</h2>
          <p>
            E-Mail: <a href="mailto:legal@dorix.eu" className="text-[#2D7A5F] underline">legal@dorix.eu</a>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Handelsregister</h2>
          <p>
            Registergericht: Amtsgericht Berlin-Charlottenburg<br />
            Registernummer: HRB 000000 B
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:<br />
            DE 000000000
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</h2>
          <p>
            DORIXÉ Marketplace UG<br />
            Musterstraße 1<br />
            10115 Berlin
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">EU-Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-[#2D7A5F] underline">
              https://ec.europa.eu/consumers/odr/
            </a>
            . Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Verbraucherstreitbeilegung</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-[#2B3441] mb-2">Haftung für Inhalte</h2>
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
          </p>
        </section>
      </div>
    </div>
  )
}
