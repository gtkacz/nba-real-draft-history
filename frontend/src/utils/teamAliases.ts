import type { TeamAbbreviation } from '@/types/team'

/**
 * Team alias map: maps historical/alternative team abbreviations to their canonical team codes.
 * 
 * Example: NJN (New Jersey Nets) is now BKN (Brooklyn Nets)
 * - Alias "NJN" should display as "NJN" in text
 * - But use BKN's logo
 * - And parse trades correctly (NJN -> BKN in trade chains)
 */
export const TEAM_ALIAS_MAP: Record<string, TeamAbbreviation> = {
  // Add your team aliases here
  'NJN': 'BKN',
  'SEA': 'OKC',
  'BAL': 'WAS',
  'BUF': 'LAC',
  'CIN': 'SAC',
  'FWP': 'DET',
  'KCK': 'SAC',
  'NOJ': 'UTA',
  // 'PRO': '',
  // 'ROR': '',
  'SDC': 'LAC',
  'SDR': 'HOU',
  // 'STH': '',
  'SYR': 'PHI',
  'TCB': 'ATL',
  'VAN': 'TOR'
}

/**
 * Get the canonical team code from an alias or team code.
 * If the team code is an alias, returns the canonical code.
 * If the team code is already canonical (or not in the map), returns it as-is.
 * 
 * @param team - Team abbreviation (alias or canonical)
 * @returns Canonical team abbreviation
 */
export function getCanonicalTeam(team: string): TeamAbbreviation | string {
  return TEAM_ALIAS_MAP[team.toUpperCase()] || team.toUpperCase()
}

/**
 * Check if a team code is an alias.
 * 
 * @param team - Team abbreviation to check
 * @returns True if the team is an alias
 */
export function isAlias(team: string): boolean {
  return team.toUpperCase() in TEAM_ALIAS_MAP
}

/**
 * Get the display name for a team (preserves alias if it's an alias, otherwise returns canonical).
 * 
 * @param team - Team abbreviation (alias or canonical)
 * @returns Display name (alias if exists, otherwise canonical)
 */
export function getDisplayTeam(team: string): string {
  return team.toUpperCase()
}

/**
 * Get all team codes (canonical + aliases) that map to the given canonical team.
 * 
 * @param canonicalTeam - Canonical team abbreviation
 * @returns Array of all team codes (canonical + aliases) that map to this team
 */
export function getAllTeamCodes(canonicalTeam: string): string[] {
  const canonical = canonicalTeam.toUpperCase()
  const codes: string[] = [canonical]
  
  // Find all aliases that map to this canonical team
  for (const [alias, mappedCanonical] of Object.entries(TEAM_ALIAS_MAP)) {
    if (mappedCanonical.toUpperCase() === canonical) {
      codes.push(alias.toUpperCase())
    }
  }
  
  return codes
}

