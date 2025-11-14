import { ref, computed } from 'vue'

export interface CountryInfo {
  officialEnglish: string
  nativeOfficial: string
}

type CountryDataMap = Record<string, CountryInfo>

const COUNTRY_DATA_CACHE_KEY = 'nba_whodunit_country_data'
const COUNTRY_DATA_VERSION = '1.0.0' // Increment if data structure changes

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

      // Get native official name - the language key is the only one in nativeName
      let nativeOfficial = ''
      if (country.name.nativeName) {
        const languageKeys = Object.keys(country.name.nativeName)
        if (languageKeys.length > 0) {
          const firstLanguage = languageKeys[0]
          const nativeNameEntry =
            country.name.nativeName[firstLanguage as keyof typeof country.name.nativeName]
          nativeOfficial = nativeNameEntry?.official || ''
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
