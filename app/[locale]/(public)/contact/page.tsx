import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { localeAlternates } from "@/lib/seo/alternates"
import { ContactForm } from "@/components/contact/ContactForm"

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "contactPage" })
  return { title: `${t("title")} — DORIXÉ`, alternates: localeAlternates("/contact", locale) }
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "contactPage" })

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-serif text-4xl font-bold text-[#2B3441] mb-2">{t("title")}</h1>
      <p className="text-[#6B7280] mb-8">{t("subtitle")}</p>
      <ContactForm
        labels={{
          name: t("nameLabel"),
          email: t("emailLabel"),
          subject: t("subjectLabel"),
          message: t("messageLabel"),
          send: t("send"),
          sending: t("sending"),
          successTitle: t("successTitle"),
          successBody: t("successBody"),
          error: t("error"),
        }}
      />
    </div>
  )
}
