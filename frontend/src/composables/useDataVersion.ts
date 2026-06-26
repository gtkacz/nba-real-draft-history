import { computed, ref } from 'vue'
import { getDataUrl } from '@/utils/dataUrl'

const dataVersion = ref<string | null>(null)
let pending: Promise<string | null> | null = null

async function fetchDataVersion(): Promise<string | null> {
  try {
    // no-store so the version itself is always fresh and can drive cache-busting of the larger files
    const response = await fetch(getDataUrl('data_version.json'), { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to fetch data_version.json: ${response.status}`)
    }
    const { version } = (await response.json()) as { version: string }
    dataVersion.value = version
    return version
  } catch (err) {
    console.error('Error loading data version:', err)
    pending = null // allow a later retry
    return null
  }
}

/**
 * Loads the published data version (a content hash stamped by the backend build)
 * once and memoizes it. Used to cache-bust data fetches and key data caches,
 * kept independent of the app version in package.json. Returns null if unavailable,
 * in which case callers fetch un-versioned URLs.
 */
export async function loadDataVersion(): Promise<string | null> {
  if (dataVersion.value !== null) {
    return dataVersion.value
  }
  if (!pending) {
    pending = fetchDataVersion()
  }
  return pending
}

export function useDataVersion() {
  return {
    dataVersion: computed(() => dataVersion.value),
    loadDataVersion,
  }
}
