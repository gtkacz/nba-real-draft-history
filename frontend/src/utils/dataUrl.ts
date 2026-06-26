/**
 * Get a data file URL that respects the base URL for GitHub Pages deployment.
 * @param path - The path relative to the data folder (e.g., 'draft_history.json')
 * @param version - Optional data version; appended as ?v= to cache-bust on data changes
 * @returns The full URL with base URL prefix (and version query when provided)
 */
export function getDataUrl(path: string, version?: string | null): string {
  const base = import.meta.env.BASE_URL
  // Remove trailing slash from base if present, then add data path
  const basePath = base.endsWith('/') ? base.slice(0, -1) : base
  const url = `${basePath}/data/${path}`
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

