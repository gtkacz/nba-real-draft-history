import { getCurrentSeasonStartYear } from './season'

export type PlayerStatus = 'active' | 'retired' | 'unknown' | 'never-debuted'

export interface PlayerStatusData {
  nba_id?: string | number | null
  played_until_year?: number | null
  plays_for?: string | null
}

export function getPlayerStatus(
  player: PlayerStatusData,
  seasonStartYear = getCurrentSeasonStartYear(),
): PlayerStatus {
  const hasNbaId = player.nba_id !== null && player.nba_id !== undefined
  const hasPlayedUntilYear =
    player.played_until_year !== null && player.played_until_year !== undefined
  const hasCurrentOrLastTeam = Boolean(player.plays_for?.trim())

  if (!hasNbaId && !hasPlayedUntilYear && !hasCurrentOrLastTeam) {
    return 'never-debuted'
  }
  if (!hasPlayedUntilYear) {
    return 'unknown'
  }
  return player.played_until_year! < seasonStartYear ? 'retired' : 'active'
}
