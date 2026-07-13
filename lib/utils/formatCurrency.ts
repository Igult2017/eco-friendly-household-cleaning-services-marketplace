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

// Suffix shown after a "from" price, based on a provider service's price unit.
export const priceUnitSuffix: Record<string, string> = {
  per_hour: "/hr",
  per_job: "/job",
  per_sqft: "/m²",
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
export function formatCurrencyForCountry(cents: number, countryCode: string, localeOverride?: string): string {
  return formatCurrency(
    cents,
    getCurrencyForCountry(countryCode),
    localeOverride ?? getLocaleForCountry(countryCode),
  )
}

export function formatCurrencyShortForCountry(cents: number, countryCode: string, localeOverride?: string): string {
  return formatCurrencyShort(
    cents,
    getCurrencyForCountry(countryCode),
    localeOverride ?? getLocaleForCountry(countryCode),
  )
}
