import { ref, computed } from 'vue'

export interface CountryInfo {
  officialEnglish: string
  nativeOfficial: string
}

type CountryDataMap = Record<string, CountryInfo>

const COUNTRY_DATA_CACHE_KEY = 'nba_whodunit_country_data'
const COUNTRY_DATA_VERSION = '1.2.0' // Increment if data structure changes

/**
 * Language preference map for countries with multiple official languages
 * Maps country code (cca2) to preferred language code(s) - will try each in order
 */
const LANGUAGE_PREFERENCES: Record<string, string[]> = {
  il: ['heb', 'he'], // Israel -> Hebrew (try both 'heb' and 'he' codes)
}

const countryDataMap = ref<CountryDataMap>({})
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * Fetches country data from the REST Countries API
 * Returns a map of cca2 -> { officialEnglish, nativeOfficial }
 */
async function fetchCountryData(): Promise<CountryDataMap> {
  try {
    const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2')
    if (!response.ok) {
      throw new Error(`Failed to fetch country data: ${response.status}`)
    }

    const countries = (await response.json()) as Array<{
      name: {
        common: string
        official: string
        nativeName?: Record<string, { official: string; common: string }>
      }
      cca2: string
    }>

    const map: CountryDataMap = {}

    for (const country of countries) {
      const cca2 = country.cca2?.toLowerCase()
      if (!cca2) continue

      const officialEnglish = country.name.official || country.name.common || ''

      // Get native official name - check for language preference first, then use first available
      let nativeOfficial = ''
      if (country.name.nativeName) {
        const languageKeys = Object.keys(country.name.nativeName)
        if (languageKeys.length > 0) {
          // Check if there's a language preference for this country
          const preferredLanguages = LANGUAGE_PREFERENCES[cca2]
          let selectedLanguage: string | undefined

          if (preferredLanguages && preferredLanguages.length > 0) {
            // Try each preferred language in order until we find one that's available
            for (const preferredLang of preferredLanguages) {
              if (languageKeys.includes(preferredLang)) {
                selectedLanguage = preferredLang
                break
              }
            }
          }

          // If no preferred language found or no preference set, use first language as fallback
          if (!selectedLanguage) {
            selectedLanguage = languageKeys[0]
          }

          if (selectedLanguage) {
            const nativeNameEntry =
              country.name.nativeName[selectedLanguage as keyof typeof country.name.nativeName]
            nativeOfficial = nativeNameEntry?.official || ''

            // Debug log for Israel to verify language selection
            if (cca2 === 'il') {
              console.log('Israel language selection:', {
                preferredLanguages,
                availableLanguages: languageKeys,
                selectedLanguage,
                nativeOfficial,
              })
            }
          }
        }
      }

      // If no native name found, use English official as fallback
      if (!nativeOfficial) {
        nativeOfficial = officialEnglish
      }

      map[cca2] = {
        officialEnglish,
        nativeOfficial,
      }
    }

    return map
  } catch (err) {
    console.error('Error fetching country data:', err)
    throw err
  }
}

/**
 * Loads country data from cache or fetches from API
 */
async function loadCountryData(): Promise<void> {
  if (Object.keys(countryDataMap.value).length > 0) {
    // Already loaded
    return
  }

  loading.value = true
  error.value = null

  try {
    // Try to load from localStorage first
    const cached = localStorage.getItem(COUNTRY_DATA_CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.version === COUNTRY_DATA_VERSION && parsed.data) {
          countryDataMap.value = parsed.data
          loading.value = false
          return
        }
      } catch {
        // Invalid cache, continue to fetch
      }
    }

    // Fetch from API
    const data = await fetchCountryData()
    countryDataMap.value = data

    // Cache in localStorage
    try {
      localStorage.setItem(
        COUNTRY_DATA_CACHE_KEY,
        JSON.stringify({
          version: COUNTRY_DATA_VERSION,
          data,
        }),
      )
    } catch (err) {
      console.warn('Failed to cache country data:', err)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load country data'
    console.error('Error loading country data:', err)
  } finally {
    loading.value = false
  }
}

/**
 * Gets country info by cca2 code
 */
function getCountryInfo(cca2: string | null | undefined): CountryInfo | null {
  if (!cca2) return null
  const normalized = cca2.toLowerCase().trim()
  return countryDataMap.value[normalized] || null
}

/**
 * Gets formatted country name for display: "Official English (Native Official)"
 */
function getFormattedCountryName(cca2: string | null | undefined): string {
  const info = getCountryInfo(cca2)
  if (!info) return cca2 || 'Unknown'

  if (info.officialEnglish === info.nativeOfficial) {
    return info.officialEnglish
  }

  return `${info.officialEnglish} (${info.nativeOfficial})`
}

/**
 * Gets all available country codes
 */
function getAllCountryCodes(): string[] {
  return Object.keys(countryDataMap.value).sort()
}

export function useCountryData() {
  return {
    countryDataMap: computed(() => countryDataMap.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loadCountryData,
    getCountryInfo,
    getFormattedCountryName,
    getAllCountryCodes,
  }
}
