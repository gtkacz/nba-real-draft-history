import { ref, computed } from 'vue'
import { getDataUrl } from '@/utils/dataUrl'
import { loadDataVersion } from '@/composables/useDataVersion'
import type { TeamAbbreviation } from '@/types/team'

type TeamMapping = Record<string, [string, number]> // abbreviation -> [full_name, id]

const teamNameMap = ref<Record<string, string>>({}) // abbreviation -> full_name
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * Loads teams_mapping.json and creates a cached map of abbreviation -> full_name
 */
async function loadTeamData(): Promise<void> {
  if (Object.keys(teamNameMap.value).length > 0) {
    // Already loaded
    return
  }

  loading.value = true
  error.value = null

  try {
    const version = await loadDataVersion()
    const response = await fetch(getDataUrl('teams_mapping.json', version))
    if (!response.ok) {
      throw new Error(`Failed to fetch teams_mapping.json: ${response.status}`)
    }

    const mapping = (await response.json()) as TeamMapping

    // Create abbreviation -> full_name map
    const nameMap: Record<string, string> = {}
    for (const [abbr, [fullName]] of Object.entries(mapping)) {
      nameMap[abbr.toUpperCase()] = fullName
    }

    teamNameMap.value = nameMap
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load team data'
    console.error('Error loading team data:', err)
  } finally {
    loading.value = false
  }
}

/**
 * Gets the full team name from an abbreviation
 * @param abbreviation - Team abbreviation (e.g., 'ATL', 'LAL')
 * @returns Full team name (e.g., 'Atlanta Hawks') or the abbreviation if not found
 */
function getTeamFullName(abbreviation: string | null | undefined): string {
  if (!abbreviation) return 'Unknown'
  const normalized = abbreviation.toUpperCase().trim()
  return teamNameMap.value[normalized] || abbreviation
}

/**
 * Gets all team abbreviations from the mapping
 */
function getAllTeamAbbreviations(): TeamAbbreviation[] {
  return Object.keys(teamNameMap.value) as TeamAbbreviation[]
}

export function useTeamData() {
  return {
    teamNameMap: computed(() => teamNameMap.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    loadTeamData,
    getTeamFullName,
    getAllTeamAbbreviations,
  }
}
