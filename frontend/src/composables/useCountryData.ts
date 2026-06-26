import { ref, computed } from 'vue'
import { getDataUrl } from '@/utils/dataUrl'
import { loadDataVersion } from '@/composables/useDataVersion'

export interface CountryInfo {
  officialEnglish: string
  nativeOfficial: string
}

type CountryDataMap = Record<string, CountryInfo>

const COUNTRY_DATA_CACHE_KEY = 'iso_country_data'

const countryDataMap = ref<CountryDataMap>({})
const loading = ref(false)
const error = ref<string | null>(null)

async function fetchCountryData(version: string | null): Promise<CountryDataMap> {
  const response = await fetch(getDataUrl('countries.json', version))
  if (!response.ok) {
    throw new Error(`Failed to fetch country data: ${response.status}`)
  }

  return (await response.json()) as CountryDataMap
}

async function loadCountryData(): Promise<void> {
  if (Object.keys(countryDataMap.value).length > 0) {
    // Already loaded
    return
  }

  loading.value = true
  error.value = null

  try {
    const version = await loadDataVersion()

    // Try the localStorage cache, keyed by the data version (not the app version)
    if (version) {
      const cached = localStorage.getItem(COUNTRY_DATA_CACHE_KEY)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.version === version && parsed.data) {
            countryDataMap.value = parsed.data
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }
    }

    const data = await fetchCountryData(version)
    countryDataMap.value = data

    if (version) {
      try {
        localStorage.setItem(COUNTRY_DATA_CACHE_KEY, JSON.stringify({ version, data }))
      } catch (err) {
        console.warn('Failed to cache country data:', err)
      }
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
let regionDisplayNames: Intl.DisplayNames | null = null

/**
 * Resolves an ISO 3166 alpha-2 code to an English country name using the browser's
 * built-in localized names. Used as a fallback when the remote country dataset is
 * unavailable so the UI shows e.g. "United States" instead of the raw "US" code.
 */
function displayNameFromCode(cca2: string | null | undefined): string {
  if (!cca2 || cca2.trim() === '') return 'Unknown'
  const code = cca2.trim().toUpperCase()
  try {
    if (!regionDisplayNames) {
      regionDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    }
    const name = regionDisplayNames.of(code)
    return name && name !== code ? name : code
  } catch {
    return code
  }
}

function getFormattedCountryName(cca2: string | null | undefined): string {
  const info = getCountryInfo(cca2)
  if (!info) return displayNameFromCode(cca2)

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
