import type { DraftPick } from '@/types/draft'
import { getAllTeamCodes } from '@/utils/teamAliases'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

export async function parseCSV(csvText: string, teamAbbreviation: string): Promise<DraftPick[]> {
  const lines = csvText.trim().split('\n')

  if (lines.length < 2) {
    console.warn(`No data in CSV for ${teamAbbreviation}`)
    return []
  }

  const picks: DraftPick[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.trim() === '') continue

    const values = parseCSVLine(line)

    if (values.length < 13) {
      console.warn(`Invalid CSV line for ${teamAbbreviation}:`, line)
      continue
    }

    const draftTrades = values[10]?.trim()
    const year = parseInt(values[0] || '0')
    
    // Skip picks that were traded away from this team (same logic as backend parser)
    // If trade string starts with "{teamAbbreviation} to " or any alias, it means this team traded the pick away
    // Need to check both the canonical team and all its aliases (e.g., SEA is an alias for OKC)
    // Also need to handle year-based aliasing (e.g., MIN pre-1988 -> LAL)
    if (draftTrades) {
      const allTeamCodes = getAllTeamCodes(teamAbbreviation, year)
      const wasTradedAway = allTeamCodes.some(teamCode => {
        // Check if trade string starts with this team code followed by " to "
        // Use word boundary or start of string to avoid false matches
        const pattern = new RegExp(`^${teamCode}\\s+to\\s+`, 'i')
        return pattern.test(draftTrades)
      })
      
      if (wasTradedAway) {
        continue
      }
    }
    
    // Remove "S" and "P" prefixes from position (e.g., "SG" -> "G", "PF" -> "F")
    let position = values[4] || ''
    if (position) {
      position = position.replace(/^[SP]/g, '')
    }

    picks.push({
      year: parseInt(values[0] || '0'),
      round: parseInt(values[1] || '0'),
      pick: parseInt(values[2] || '0'),
      player: values[3] || '',
      position: position,
      height: values[5] || '',
      weight: parseFloat(values[6] || '0'),
      age: parseFloat(values[7] || '0'),
      preDraftTeam: values[8] || '',
      class: values[9] || '',
      draftTrades: draftTrades && draftTrades !== '' ? draftTrades : null,
      yearsOfService: parseInt(values[11] || '0'),
      team: teamAbbreviation,
      teamLogo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${teamAbbreviation.toLowerCase()}.svg`
    })
  }

  return picks
}
