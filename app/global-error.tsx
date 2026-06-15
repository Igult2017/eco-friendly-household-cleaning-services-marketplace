"use client"

import * as Sentry from "@sentry/nextjs"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("globalerror")

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#F4FAF6] p-8 text-center">
        <div className="max-w-md space-y-4">
          <div className="text-5xl">⚠️</div>
          <h1 className="font-serif text-2xl font-bold text-[#2B3441]">{t("title")}</h1>
          <p className="text-sm text-[#6B7280]">
            {t("description")}
          </p>
          {error.digest && (
            <p className="text-xs text-[#6B7280] font-mono bg-white border border-gray-200 rounded px-3 py-1">
              {t("errorId", { digest: error.digest })}
            </p>
          )}
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-[#2D7A5F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#245f4a] transition-colors"
          >
            {t("tryAgain")}
          </button>
        </div>
      </body>
    </html>
  )
}
