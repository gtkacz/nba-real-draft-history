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
  nba_id?: string | number
}

export interface TradeStep {
  from: string
  to: string
}

export interface ParsedTrade {
  original: string
  steps: TradeStep[]
  finalTeam: string
}
