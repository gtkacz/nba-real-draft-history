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
}
