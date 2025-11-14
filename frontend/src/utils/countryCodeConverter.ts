/**
 * Converts a country code to lowercase for flag display
 * Falls back to "un" if null or undefined
 * @param country - Country code (already parsed from CSV)
 * @returns Lowercase country code or "un" if null/undefined
 */
export function getCountryCode(country: string | null | undefined): string {
  if (!country || typeof country !== 'string') {
    return 'un'
  }

  return country.trim().toLowerCase() || 'un'
}
