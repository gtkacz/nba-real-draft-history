export interface DraftPick {
  year: number
  round: number
  pick: number
  player: string
  position: string
  height: string
  weight: number
  age: number
  preDraftTeam: string
  class: string
  draftTrades: string | null
  yearsOfService: number
  team: string
  teamLogo?: string
  nba_id?: string | number | null
  origin_country?: string | null
  played_until_year?: number | null
  is_defunct?: number | null
  plays_for?: string | null
  awards?: Record<string, number>
  // Set on rows synthesized from a forfeited pick rather than a drafted player.
  isForfeited?: boolean
  forfeitReason?: string
  forfeitSource?: string | null
  // The curated overall slot (or null when the pick held no slot), preserved for
  // display because `pick` itself carries a synthetic end-of-round sort value.
  forfeitDisplayPick?: number | null
}

// Raw shape of an entry in forfeited_picks.json, curated by hand. A forfeited
// pick is a draft slot a team was stripped of as a league penalty, not a player.
export interface ForfeitedPick {
  year: number
  round: number
  pick: number | null
  team: string
  reason: string
  source?: string | null
}
