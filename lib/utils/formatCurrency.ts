import { getCurrencyForCountry, getLocaleForCountry } from "./locale"

// Format cents with an explicit currency code. Default: EUR, en-GB locale.
// Existing callers that pass no args or formatCurrency(amount) continue to work.
export function formatCurrency(
  cents: number,
  currency: "EUR" | "USD" = "EUR",
  locale = "en-GB",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

// Short form: no decimal cents (€22 not €22.00).
export function formatCurrencyShort(
  cents: number,
  currency: "EUR" | "USD" = "EUR",
  locale = "en-GB",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

// Convenience: infer currency and locale from a 2-letter ISO country code.
// Use this when you have the user's country but not an explicit currency.
export function formatCurrencyForCountry(cents: number, countryCode: string): string {
  return formatCurrency(
    cents,
    getCurrencyForCountry(countryCode),
    getLocaleForCountry(countryCode),
  )
}

export function formatCurrencyShortForCountry(cents: number, countryCode: string): string {
  return formatCurrencyShort(
    cents,
    getCurrencyForCountry(countryCode),
    getLocaleForCountry(countryCode),
  )
}
