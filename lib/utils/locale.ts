// US pays in USD; every other market the platform serves uses EUR.
export function getCurrencyForCountry(countryCode: string): "EUR" | "USD" {
  return countryCode === "US" ? "USD" : "EUR"
}

// Map 2-letter ISO country code → BCP-47 locale tag for Intl formatters.
const LOCALE_MAP: Record<string, string> = {
  US: "en-US",
  GB: "en-GB",
  IE: "en-IE",
  DE: "de-DE",
  AT: "de-AT",
  CH: "de-CH",
  FR: "fr-FR",
  BE: "fr-BE",
  NL: "nl-NL",
  LU: "fr-LU",
  ES: "es-ES",
  IT: "it-IT",
  PT: "pt-PT",
  PL: "pl-PL",
  CZ: "cs-CZ",
  SK: "sk-SK",
  HU: "hu-HU",
  RO: "ro-RO",
  BG: "bg-BG",
  HR: "hr-HR",
  SI: "sl-SI",
  SE: "sv-SE",
  NO: "nb-NO",
  DK: "da-DK",
  FI: "fi-FI",
  EE: "et-EE",
  LV: "lv-LV",
  LT: "lt-LT",
  GR: "el-GR",
  CY: "el-CY",
  MT: "mt-MT",
}

// Default to en-GB (EU-facing neutral English) for unmapped countries.
export function getLocaleForCountry(countryCode: string): string {
  return LOCALE_MAP[countryCode] ?? "en-GB"
}

const KM_TO_MILES = 0.621371

// Show km for EU; miles for USA. Round to nearest whole unit.
export function formatDistance(km: number, countryCode: string): string {
  if (countryCode === "US") {
    return `${Math.round(km * KM_TO_MILES)} mi`
  }
  return `${Math.round(km)} km`
}

// Human-readable distance radius label used in search UI.
export function formatRadius(km: number, countryCode: string): string {
  if (countryCode === "US") {
    return `${Math.round(km * KM_TO_MILES)} miles`
  }
  return `${km} km`
}

// "Postal code" is correct in both markets. Returns the right field label.
export function getPostalLabel(countryCode: string): string {
  return countryCode === "US" ? "ZIP code" : "Postal code"
}
