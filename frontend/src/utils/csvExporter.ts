import type { DraftPick } from '@/types/draft'

/**
 * Escapes a value for CSV format
 * Handles quotes, commas, and newlines
 */
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)
  
  // If the value contains quotes, commas, or newlines, wrap it in quotes and escape internal quotes
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  
  return stringValue
}

/**
 * Converts an array of DraftPick objects to CSV format
 * Includes all fields from the DraftPick interface
 */
export function exportDraftPicksToCSV(picks: DraftPick[]): string {
  // Define CSV headers matching all fields
  const headers = [
    'Year',
    'Round',
    'Pick',
    'Player',
    'Position',
    'Height',
    'Weight',
    'Age',
    'Pre-Draft Team',
    'Class',
    'Draft Trades',
    'Years of Service',
    'Team',
    'nba_id',
    'origin_country',
    'played_until_year',
    'is_defunct'
  ]

  // Create header row
  const headerRow = headers.map(escapeCSVValue).join(',')

  // Create data rows
  const dataRows = picks.map(pick => {
    return [
      pick.year ?? '',
      pick.round ?? '',
      pick.pick ?? '',
      pick.player ?? '',
      pick.position ?? '',
      pick.height ?? '',
      pick.weight ?? '',
      pick.age ?? '',
      pick.preDraftTeam ?? '',
      pick.class ?? '',
      pick.draftTrades ?? '',
      pick.yearsOfService ?? '',
      pick.team ?? '',
      pick.nba_id ?? '',
      pick.origin_country ?? '',
      pick.played_until_year ?? '',
      pick.is_defunct ?? ''
    ].map(escapeCSVValue).join(',')
  })

  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n')
}

/**
 * Triggers a browser download of CSV data
 */
export function downloadCSV(csvContent: string, filename: string = 'nba_draft_data.csv'): void {
  // Create a blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // Create a download link
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  // Trigger download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up the object URL
  URL.revokeObjectURL(url)
}

