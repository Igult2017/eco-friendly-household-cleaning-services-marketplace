// Single source of truth for countries the marketplace serves (EU + US — never hardcode one market).
// [ISO 3166-1 alpha-2, English display name] — country names are proper nouns, shown as-is in all locales.
export const SUPPORTED_COUNTRIES: [string, string][] = [
  ["DE", "Germany"], ["NL", "Netherlands"], ["BE", "Belgium"], ["AT", "Austria"],
  ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"], ["PL", "Poland"],
  ["SE", "Sweden"], ["DK", "Denmark"], ["FI", "Finland"], ["NO", "Norway"],
  ["CH", "Switzerland"], ["PT", "Portugal"], ["IE", "Ireland"],
  ["US", "United States"],
]

export function isSupportedCountry(code: string): boolean {
  return SUPPORTED_COUNTRIES.some(([c]) => c === code)
}
