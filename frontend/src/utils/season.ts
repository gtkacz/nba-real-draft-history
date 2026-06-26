// The NBA season spans two calendar years (it tips off in October). The data stores
// played_until_year as the START year of a player's most recent season, so deciding
// whether a player is active "this season" must compare against the current SEASON's
// start year rather than the calendar year. Comparing against the calendar year marks
// every current player as retired during the Jan-Sep stretch of a season (e.g. in
// mid-2026 a 2025-26 player has played_until_year 2025, which is < 2026).

// Date.getMonth() is 0-indexed; the NBA regular season begins in October.
const NBA_SEASON_START_MONTH = 9

/**
 * The starting calendar year of the NBA season currently in progress (or the most
 * recent one, during the off-season before October).
 */
export function getCurrentSeasonStartYear(): number {
  const now = new Date()
  return now.getMonth() >= NBA_SEASON_START_MONTH ? now.getFullYear() : now.getFullYear() - 1
}
