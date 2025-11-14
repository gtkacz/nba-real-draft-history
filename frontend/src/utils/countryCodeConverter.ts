// Cache for country name to ISO code conversions
const countryNameCache = new Map<string, string>()

// Cache for ISO alpha-3 to alpha-2 conversions
const alpha3ToAlpha2Cache = new Map<string, string>()

/**
 * Comprehensive mapping of ISO 3166-1 alpha-3 to alpha-2
 */
const alpha3ToAlpha2Mapping: Record<string, string> = {
  'AFG': 'AF', 'ALA': 'AX', 'ALB': 'AL', 'DZA': 'DZ', 'ASM': 'AS', 'AND': 'AD', 'AGO': 'AO',
  'AIA': 'AI', 'ATA': 'AQ', 'ATG': 'AG', 'ARG': 'AR', 'ARM': 'AM', 'ABW': 'AW', 'AUS': 'AU',
  'AUT': 'AT', 'AZE': 'AZ', 'BHS': 'BS', 'BHR': 'BH', 'BGD': 'BD', 'BRB': 'BB', 'BLR': 'BY',
  'BEL': 'BE', 'BLZ': 'BZ', 'BEN': 'BJ', 'BMU': 'BM', 'BTN': 'BT', 'BOL': 'BO', 'BES': 'BQ',
  'BIH': 'BA', 'BWA': 'BW', 'BVT': 'BV', 'BRA': 'BR', 'IOT': 'IO', 'BRN': 'BN', 'BGR': 'BG',
  'BFA': 'BF', 'BDI': 'BI', 'CPV': 'CV', 'KHM': 'KH', 'CMR': 'CM', 'CAN': 'CA', 'CYM': 'KY',
  'CAF': 'CF', 'TCD': 'TD', 'CHL': 'CL', 'CHN': 'CN', 'CXR': 'CX', 'CCK': 'CC', 'COL': 'CO',
  'COM': 'KM', 'COG': 'CG', 'COD': 'CD', 'COK': 'CK', 'CRI': 'CR', 'CIV': 'CI', 'HRV': 'HR',
  'CUB': 'CU', 'CUW': 'CW', 'CYP': 'CY', 'CZE': 'CZ', 'DNK': 'DK', 'DJI': 'DJ', 'DMA': 'DM',
  'DOM': 'DO', 'ECU': 'EC', 'EGY': 'EG', 'SLV': 'SV', 'GNQ': 'GQ', 'ERI': 'ER', 'EST': 'EE',
  'SWZ': 'SZ', 'ETH': 'ET', 'FLK': 'FK', 'FRO': 'FO', 'FJI': 'FJ', 'FIN': 'FI', 'FRA': 'FR',
  'GUF': 'GF', 'PYF': 'PF', 'ATF': 'TF', 'GAB': 'GA', 'GMB': 'GM', 'GEO': 'GE', 'DEU': 'DE',
  'GHA': 'GH', 'GIB': 'GI', 'GRC': 'GR', 'GRL': 'GL', 'GRD': 'GD', 'GLP': 'GP', 'GUM': 'GU',
  'GTM': 'GT', 'GGY': 'GG', 'GIN': 'GN', 'GNB': 'GW', 'GUY': 'GY', 'HTI': 'HT', 'HMD': 'HM',
  'VAT': 'VA', 'HND': 'HN', 'HKG': 'HK', 'HUN': 'HU', 'ISL': 'IS', 'IND': 'IN', 'IDN': 'ID',
  'IRN': 'IR', 'IRQ': 'IQ', 'IRL': 'IE', 'IMN': 'IM', 'ISR': 'IL', 'ITA': 'IT', 'JAM': 'JM',
  'JPN': 'JP', 'JEY': 'JE', 'JOR': 'JO', 'KAZ': 'KZ', 'KEN': 'KE', 'KIR': 'KI', 'PRK': 'KP',
  'KOR': 'KR', 'KWT': 'KW', 'KGZ': 'KG', 'LAO': 'LA', 'LVA': 'LV', 'LBN': 'LB', 'LSO': 'LS',
  'LBR': 'LR', 'LBY': 'LY', 'LIE': 'LI', 'LTU': 'LT', 'LUX': 'LU', 'MAC': 'MO', 'MDG': 'MG',
  'MWI': 'MW', 'MYS': 'MY', 'MDV': 'MV', 'MLI': 'ML', 'MLT': 'MT', 'MHL': 'MH', 'MTQ': 'MQ',
  'MRT': 'MR', 'MUS': 'MU', 'MYT': 'YT', 'MEX': 'MX', 'FSM': 'FM', 'MDA': 'MD', 'MCO': 'MC',
  'MNG': 'MN', 'MNE': 'ME', 'MSR': 'MS', 'MAR': 'MA', 'MOZ': 'MZ', 'MMR': 'MM', 'NAM': 'NA',
  'NRU': 'NR', 'NPL': 'NP', 'NLD': 'NL', 'NCL': 'NC', 'NZL': 'NZ', 'NIC': 'NI', 'NER': 'NE',
  'NGA': 'NG', 'NIU': 'NU', 'NFK': 'NF', 'MKD': 'MK', 'MNP': 'MP', 'NOR': 'NO', 'OMN': 'OM',
  'PAK': 'PK', 'PLW': 'PW', 'PSE': 'PS', 'PAN': 'PA', 'PNG': 'PG', 'PRY': 'PY', 'PER': 'PE',
  'PHI': 'PH', 'PCN': 'PN', 'POL': 'PL', 'PRT': 'PT', 'PRI': 'PR', 'QAT': 'QA', 'REU': 'RE',
  'ROU': 'RO', 'RUS': 'RU', 'RWA': 'RW', 'BLM': 'BL', 'SHN': 'SH', 'KNA': 'KN', 'LCA': 'LC',
  'MAF': 'MF', 'SPM': 'PM', 'VCT': 'VC', 'WSM': 'WS', 'SMR': 'SM', 'STP': 'ST', 'SAU': 'SA',
  'SEN': 'SN', 'SRB': 'RS', 'SYC': 'SC', 'SLE': 'SL', 'SGP': 'SG', 'SXM': 'SX', 'SVK': 'SK',
  'SVN': 'SI', 'SLB': 'SB', 'SOM': 'SO', 'ZAF': 'ZA', 'SGS': 'GS', 'SSD': 'SS', 'ESP': 'ES',
  'LKA': 'LK', 'SDN': 'SD', 'SUR': 'SR', 'SJM': 'SJ', 'SWE': 'SE', 'CHE': 'CH', 'SYR': 'SY',
  'TWN': 'TW', 'TJK': 'TJ', 'TZA': 'TZ', 'THA': 'TH', 'TLS': 'TL', 'TGO': 'TG', 'TKL': 'TK',
  'TON': 'TO', 'TTO': 'TT', 'TUN': 'TN', 'TUR': 'TR', 'TKM': 'TM', 'TCA': 'TC', 'TUV': 'TV',
  'UGA': 'UG', 'UKR': 'UA', 'ARE': 'AE', 'GBR': 'GB', 'UMI': 'UM', 'USA': 'US', 'URY': 'UY',
  'UZB': 'UZ', 'VUT': 'VU', 'VEN': 'VE', 'VNM': 'VN', 'VGB': 'VG', 'VIR': 'VI', 'WLF': 'WF',
  'ESH': 'EH', 'YEM': 'YE', 'ZMB': 'ZM', 'ZWE': 'ZW'
}

/**
 * Checks if a string is an ISO 3166-1 alpha-3 code (3 uppercase letters)
 */
function isISOAlpha3(code: string): boolean {
  return /^[A-Z]{3}$/.test(code.trim())
}

/**
 * Converts ISO 3166-1 alpha-3 country code to alpha-2 code
 */
function alpha3ToAlpha2Internal(alpha3: string): string | null {
  const code = alpha3.trim().toUpperCase()
  
  // Check cache first
  if (alpha3ToAlpha2Cache.has(code)) {
    return alpha3ToAlpha2Cache.get(code) || null
  }
  
  const result = alpha3ToAlpha2Mapping[code] || null
  
  // Cache the result
  if (result) {
    alpha3ToAlpha2Cache.set(code, result)
  }
  
  return result
}

/**
 * Fetches ISO alpha-2 code from REST Countries API for a country name
 */
async function fetchCountryCodeFromAPI(countryName: string): Promise<string | null> {
  try {
    const encodedName = encodeURIComponent(countryName.trim())
    const response = await fetch(`https://restcountries.com/v3.1/name/${encodedName}?fields=cca2`)
    
    if (response.status === 404) {
      return null
    }
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    // Response format: [{"cca2":"DE"}]
    if (Array.isArray(data) && data.length > 0 && data[0].cca2) {
      return data[0].cca2.toUpperCase()
    }
    
    return null
  } catch (error) {
    console.error(`Error fetching country code for "${countryName}":`, error)
    return null
  }
}

/**
 * Converts a country identifier (ISO alpha-3 code or country name) to ISO alpha-2 code
 * Falls back to "un" if no country is found
 * @param country - ISO 3166-1 alpha-3 code (e.g., "USA", "FRA") or country name (e.g., "United States", "France")
 * @returns ISO 3166-1 alpha-2 country code (e.g., "US", "FR") or "un" if not found
 */
export async function countryToAlpha2(country: string | null | undefined): Promise<string> {
  if (!country || typeof country !== 'string') {
    return 'un'
  }

  const trimmed = country.trim()
  if (!trimmed) {
    return 'un'
  }

  // Check if it's already an ISO alpha-3 code
  if (isISOAlpha3(trimmed)) {
    const alpha2 = alpha3ToAlpha2Internal(trimmed)
    return alpha2 || 'un'
  }

  // Check cache for country name
  const cacheKey = trimmed.toLowerCase()
  if (countryNameCache.has(cacheKey)) {
    return countryNameCache.get(cacheKey) || 'un'
  }

  // Fetch from API
  const alpha2 = await fetchCountryCodeFromAPI(trimmed)
  const result = alpha2 || 'un'
  
  // Cache the result
  countryNameCache.set(cacheKey, result)
  
  return result
}

/**
 * Synchronous version that returns a promise
 * For use in templates, you'll need to handle the promise
 */
export function countryToAlpha2Sync(country: string | null | undefined): string {
  if (!country || typeof country !== 'string') {
    return 'un'
  }

  const trimmed = country.trim()
  if (!trimmed) {
    return 'un'
  }

  // Check if it's already an ISO alpha-3 code
  if (isISOAlpha3(trimmed)) {
    const alpha2 = alpha3ToAlpha2Internal(trimmed)
    return alpha2 || 'un'
  }

  // For country names, we need async, so return 'un' as fallback
  // The component should use the async version
  return 'un'
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use countryToAlpha2 instead
 */
export function alpha3ToAlpha2(alpha3: string | null | undefined): string | null {
  if (!alpha3 || typeof alpha3 !== 'string') {
    return null
  }

  const code = alpha3.trim().toUpperCase()
  return alpha3ToAlpha2Internal(code)
}
