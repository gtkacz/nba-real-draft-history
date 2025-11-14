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

  // Parse header to find column indices
  const headerLine = lines[0]
  const headerValues = parseCSVLine(headerLine)
  
  // Find column indices by name (case-insensitive)
  const getColumnIndex = (name: string): number => {
    return headerValues.findIndex(col => col.toLowerCase() === name.toLowerCase())
  }
  
  const yearIndex = getColumnIndex('Year')
  const roundIndex = getColumnIndex('Round')
  const pickIndex = getColumnIndex('Pick')
  const playerIndex = getColumnIndex('Player')
  const posIndex = getColumnIndex('Pos')
  const htIndex = getColumnIndex('HT')
  const wtIndex = getColumnIndex('WT')
  const ageIndex = getColumnIndex('Age')
  const preDraftTeamIndex = getColumnIndex('Pre-Draft Team')
  const classIndex = getColumnIndex('Class')
  const draftTradesIndex = getColumnIndex('Draft Trades')
  const yosIndex = getColumnIndex('YOS')
  const nbaIdIndex = getColumnIndex('nba_id')
  const originCountryIndex = getColumnIndex('origin_country')
  const playedUntilYearIndex = getColumnIndex('played_until_year')
  const isDefunctIndex = getColumnIndex('is_defunct')
  
  // Check if we have the minimum required columns (Team is no longer required)
  const requiredIndices = [yearIndex, roundIndex, pickIndex, playerIndex, posIndex, htIndex, wtIndex, ageIndex, preDraftTeamIndex, classIndex, draftTradesIndex, yosIndex]
  const missingColumns = requiredIndices.filter(idx => idx === -1)
  
  if (missingColumns.length > 0) {
    console.error(`CSV for ${teamAbbreviation} is missing required columns. Found columns:`, headerValues)
    return []
  }

  const picks: DraftPick[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.trim() === '') continue

    const values = parseCSVLine(line)

    // Require at least as many columns as the header (or minimum required)
    const minRequiredColumns = Math.max(13, headerValues.length - 1) // Allow for missing optional columns
    if (values.length < minRequiredColumns) {
      // Only warn if significantly fewer columns (more than 2 missing)
      if (values.length < 11) {
        console.warn(`Invalid CSV line for ${teamAbbreviation} (expected at least ${minRequiredColumns} columns, got ${values.length}):`, line.substring(0, 100))
      }
      // Try to parse anyway if we have at least the essential columns
      if (values.length < 11) {
        continue
      }
    }

    const draftTrades = values[draftTradesIndex]?.trim()
    const year = parseInt(values[yearIndex] || '0')
    
    // Extract nba_id if available (check index is valid and value exists and is not empty)
    const nbaId = nbaIdIndex >= 0 && nbaIdIndex < values.length && values[nbaIdIndex] && values[nbaIdIndex].trim() !== '' 
      ? values[nbaIdIndex].trim() 
      : undefined
    
    // Extract new columns if available
    const originCountry = originCountryIndex >= 0 && originCountryIndex < values.length && values[originCountryIndex] && values[originCountryIndex].trim() !== ''
      ? values[originCountryIndex].trim()
      : undefined
    
    const playedUntilYear = playedUntilYearIndex >= 0 && playedUntilYearIndex < values.length && values[playedUntilYearIndex] && values[playedUntilYearIndex].trim() !== ''
      ? (() => {
          const val = parseFloat(values[playedUntilYearIndex].trim())
          return !isNaN(val) ? val : undefined
        })()
      : undefined
    
    const isDefunct = isDefunctIndex >= 0 && isDefunctIndex < values.length && values[isDefunctIndex] && values[isDefunctIndex].trim() !== ''
      ? (() => {
          const val = parseFloat(values[isDefunctIndex].trim())
          return !isNaN(val) ? val : undefined
        })()
      : undefined
    
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
    let position = values[posIndex] || ''
    if (position) {
      position = position.replace(/^[SP]/g, '')
    }

    picks.push({
      year: parseInt(values[yearIndex] || '0'),
      round: parseInt(values[roundIndex] || '0'),
      pick: parseInt(values[pickIndex] || '0'),
      player: values[playerIndex] || '',
      position: position,
      height: values[htIndex] || '',
      weight: parseFloat(values[wtIndex] || '0'),
      age: parseFloat(values[ageIndex] || '0'),
      preDraftTeam: values[preDraftTeamIndex] || '',
      class: values[classIndex] || '',
      draftTrades: draftTrades && draftTrades !== '' ? draftTrades : null,
      yearsOfService: parseInt(values[yosIndex] || '0'),
      team: teamAbbreviation,
      teamLogo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${teamAbbreviation.toLowerCase()}.svg`,
      nba_id: nbaId ? (isNaN(Number(nbaId)) ? nbaId : Number(nbaId)) : undefined,
      origin_country: originCountry,
      played_until_year: playedUntilYear,
      is_defunct: isDefunct
    })
  }

  return picks
}
