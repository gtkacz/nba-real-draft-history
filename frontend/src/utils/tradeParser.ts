import type { ParsedTrade, TradeStep } from '@/types/draft'
import { getDisplayTeam } from '@/utils/teamAliases'

export function parseDraftTrade(tradeString: string | null): ParsedTrade | null {
  if (!tradeString || tradeString.trim() === '') {
    return null
  }

  const steps: TradeStep[] = []
  const parts = tradeString.split(' to ')

  for (let i = 0; i < parts.length - 1; i++) {
    const fromRaw = parts[i]?.trim().split(' ').pop() || ''
    const toRaw = parts[i + 1]?.trim().split(' ')[0] || ''

    if (fromRaw && toRaw) {
      // Preserve display names (aliases are preserved for display)
      const fromDisplay = getDisplayTeam(fromRaw)
      const toDisplay = getDisplayTeam(toRaw)
      
      steps.push({ 
        from: fromDisplay, 
        to: toDisplay
      })
    }
  }

  const finalStep = steps[steps.length - 1]
  const finalTeam = finalStep ? getDisplayTeam(finalStep.to) : ''

  return {
    original: tradeString,
    steps,
    finalTeam
  }
}
