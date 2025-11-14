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
  'ROR': 'SAC',
  'SDC': 'LAC',
  'SDR': 'HOU',
  'STH': 'ATL',
  'SYR': 'PHI',
  'TCB': 'ATL',
  'VAN': 'MEM'
}

/**
 * Get the canonical team code from an alias or team code.
 * If the team code is an alias, returns the canonical code.
 * If the team code is already canonical (or not in the map), returns it as-is.
 * 
 * @param team - Team abbreviation (alias or canonical)
 * @param year - Optional year for year-based aliasing (e.g., MIN pre-1988 -> LAL)
 * @returns Canonical team abbreviation
 */
export function getCanonicalTeam(team: string, year?: number): TeamAbbreviation | string {
  const upperTeam = team.toUpperCase()
  
  // Handle year-based aliasing: MIN pre-1988 refers to Lakers (LAL), not Timberwolves
  if (upperTeam === 'MIN' && year !== undefined && year < 1988) {
    return 'LAL'
  }
  
  return TEAM_ALIAS_MAP[upperTeam] || upperTeam
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
 * This function returns the non-aliased/original team name for display purposes.
 * 
 * @param team - Team abbreviation (alias or canonical)
 * @param year - Optional year for year-based aliasing
 * @returns Display name (non-aliased/original team name)
 */
export function getDisplayTeam(team: string, year?: number): string {
  const upperTeam = team.toUpperCase()
  
  // For display, we want to show the original/non-aliased name
  // If this is a canonical team that has aliases, we need to find the original alias
  // But for simplicity, we'll just return the team as-is since the data should already have the original
  // However, we need to handle the special case: if canonical is LAL and year < 1988, show MIN
  if (upperTeam === 'LAL' && year !== undefined && year < 1988) {
    // Check if this LAL pick should be displayed as MIN (reverse lookup)
    // Actually, if the data has MIN, it should already be MIN. But if it's LAL from MIN alias, we want MIN
    // For now, we'll return the team as-is - the data should preserve the original
    return upperTeam
  }
  
  return upperTeam
}

/**
 * Get the original/non-aliased team name for display.
 * This function takes a team code (which might be canonical or already original) and returns
 * the original/non-aliased name for display purposes.
 * 
 * The team field in the data comes from CSV filenames, which use canonical codes (e.g., "BKN.csv").
 * We only want to show aliases when:
 * 1. The team is already an alias in the data (shouldn't happen with current structure, but handle it)
 * 2. Special year-based case: LAL pre-1988 should show as MIN
 * 
 * @param team - Team abbreviation (usually canonical from CSV filename)
 * @param year - Optional year for year-based aliasing
 * @returns Original team name (non-aliased name for display)
 */
export function getOriginalTeamName(team: string, year?: number): string {
  const upperTeam = team.toUpperCase()
  
  // Special case: if team is LAL and year < 1988, the original was MIN
  if (upperTeam === 'LAL' && year !== undefined && year < 1988) {
    return 'MIN'
  }
  
  // Special case: MIN pre-1988 is already the original (it refers to Lakers, not Timberwolves)
  // So if team is MIN and year < 1988, return MIN as-is
  if (upperTeam === 'MIN' && year !== undefined && year < 1988) {
    return 'MIN'
  }
  
  // Check if this team is an alias - if so, return it as-is (it's already the original)
  // This handles cases where the data might have an alias code
  if (upperTeam in TEAM_ALIAS_MAP) {
    return upperTeam
  }
  
  // For canonical teams, return as-is (don't try to find an alias)
  // The CSV files use canonical codes, so we display the canonical name
  return upperTeam
}

/**
 * Get all team codes (canonical + aliases) that map to the given canonical team.
 * 
 * @param canonicalTeam - Canonical team abbreviation
 * @param year - Optional year for year-based aliasing
 * @returns Array of all team codes (canonical + aliases) that map to this team
 */
export function getAllTeamCodes(canonicalTeam: string, year?: number): string[] {
  const canonical = canonicalTeam.toUpperCase()
  const codes: string[] = [canonical]
  
  // Special case: if canonical is LAL and year < 1988, include MIN
  if (canonical === 'LAL' && year !== undefined && year < 1988) {
    codes.push('MIN')
  }
  
  // Find all aliases that map to this canonical team
  for (const [alias, mappedCanonical] of Object.entries(TEAM_ALIAS_MAP)) {
    if (mappedCanonical.toUpperCase() === canonical) {
      codes.push(alias.toUpperCase())
    }
  }
  
  return codes
}

