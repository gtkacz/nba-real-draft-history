import { getCanonicalTeam } from '@/utils/teamAliases'

/**
 * Extracts the canonical team codes that appear in a pick's trade chain.
 *
 * The raw format chains hops together, e.g. "WAS to  NYK NYK  to OKC" or
 * "ATL to HOU HOU to ATL". Each hop is "<from> to <to>"; we keep the leading
 * team of every segment so the result preserves the order the pick changed hands.
 * Aliases are resolved to their canonical code so membership tests are reliable
 * regardless of which historical abbreviation the source data used.
 */
export function getTradeChainCanonicalTeams(
  trades: string | null | undefined,
  year?: number,
): string[] {
  if (!trades || trades.trim() === '') return []

  const segments = trades
    .split(/\s+to\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (segments.length < 2) return []

  const teams: string[] = []
  for (const segment of segments) {
    const abbreviation = segment.split(/\s+/)[0]
    // Team abbreviations are at most 4 characters; longer tokens are noise.
    if (abbreviation && abbreviation.length <= 4) {
      teams.push(getCanonicalTeam(abbreviation, year))
    }
  }

  return teams
}
