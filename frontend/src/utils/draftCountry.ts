// Classifies the country a player was drafted from, derived from the trailing
// parenthetical of `preDraftTeam` (e.g. "Valencia Basket (Spain)" -> Spain).
// The dataset also uses that parenthetical for US states and abbreviations
// ("Miami (FL)", "Lower Merion High School (Pennsylvania)"), so a bare or
// unrecognized parenthetical falls back to the US rather than being treated as
// a country.

// ISO 3166-1 alpha-2 code used for any draft origin that is not a recognizable
// foreign country: bare US colleges, US states/abbreviations, and "(United States)".
export const US_DRAFT_COUNTRY = 'us'

// Sentinel filter value for the "all non-US countries" umbrella option. It is not
// a real ISO code, so it can never collide with a resolved country.
export const NON_US_DRAFT_COUNTRY = 'non-us'

// A trailing "(...)" usually names the origin country, but three cases need help:
// (a) tokens whose dataset spelling differs from Intl.DisplayNames' spelling,
// (b) sub-national regions that should roll up to their country, and
// (c) "Georgia", which in this dataset is always the US state, never the country.
const TOKEN_COUNTRY_OVERRIDES: Readonly<Record<string, string>> = {
  'united states': US_DRAFT_COUNTRY,
  georgia: US_DRAFT_COUNTRY,
  ontario: 'ca',
  'australian capital territory': 'au',
  'bosnia and herzegovina': 'ba',
  'hong kong': 'hk',
  turkey: 'tr',
}

const TRAILING_PARENTHETICAL = /\(([^)]+)\)\s*$/

export function extractTrailingParenthetical(team: string): string | null {
  const match = team.trim().match(TRAILING_PARENTHETICAL)
  const token = match?.[1]
  return token ? token.trim() : null
}

/**
 * Builds a reverse lookup from lowercased English country name to ISO 3166-1
 * alpha-2 code, using the same Intl.DisplayNames resolver the rest of the app
 * relies on. `codes` should be the full set of known ISO codes (e.g. the keys of
 * the loaded countries dataset).
 */
export function buildCountryNameToCode(codes: Iterable<string>): Map<string, string> {
  const nameToCode = new Map<string, string>()
  let displayNames: Intl.DisplayNames
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return nameToCode
  }
  for (const code of codes) {
    let name: string | undefined
    try {
      name = displayNames.of(code.toUpperCase())
    } catch {
      continue
    }
    // Intl echoes the input back when it doesn't recognize the region.
    if (!name || name.toLowerCase() === code.toLowerCase()) continue
    nameToCode.set(name.toLowerCase(), code.toLowerCase())
  }
  return nameToCode
}

/**
 * Resolves the country a player was drafted from to an ISO 3166-1 alpha-2 code.
 * Falls back to the US for bare US colleges, US states, and unrecognized tokens.
 */
export function resolveDraftCountryCode(
  team: string | null | undefined,
  nameToCode: ReadonlyMap<string, string>,
): string {
  if (!team || team.trim() === '') return US_DRAFT_COUNTRY
  const token = extractTrailingParenthetical(team)
  if (!token) return US_DRAFT_COUNTRY
  const key = token.toLowerCase()
  const override = TOKEN_COUNTRY_OVERRIDES[key]
  if (override) return override
  return nameToCode.get(key) ?? US_DRAFT_COUNTRY
}
