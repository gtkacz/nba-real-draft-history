import { ref, computed } from 'vue'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { parseCSV } from '@/utils/csvParser'
import { getDataUrl } from '@/utils/dataUrl'

const allDraftPicks = ref<DraftPick[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function useDraftData() {
  const selectedTeam = ref<TeamAbbreviation[]>([])
  const selectedYear = ref<number | null>(null)
  const yearRange = ref<[number, number]>([1950, 2025])
  const useYearRange = ref(true)
  const selectedRounds = ref<(number | string)[]>([])
  const overallPickRange = ref<[number, number]>([1, 61])
  const preDraftTeamSearch = ref<string[]>([])
  const tradeFilter = ref<'all' | 'traded' | 'not-traded'>('all')

  const allPreDraftTeams = computed(() => {
    const teams = new Set<string>()
    allDraftPicks.value.forEach(pick => {
      if (pick.preDraftTeam && pick.preDraftTeam.trim() !== '') {
        teams.add(pick.preDraftTeam)
      }
    })
    return Array.from(teams).sort()
  })

  const availableYears = computed(() => {
    const years = new Set<number>()
    allDraftPicks.value.forEach(pick => years.add(pick.year))
    return Array.from(years).sort((a, b) => b - a) // Sort descending
  })

  const filteredData = computed(() => {
    let filtered = allDraftPicks.value

    // Team filter - multiple selection
    if (selectedTeam.value.length > 0) {
      filtered = filtered.filter(pick => selectedTeam.value.includes(pick.team))
    }

    // Year filter
    if (useYearRange.value) {
      // Year range filter
      if (yearRange.value && yearRange.value.length === 2) {
        const [minYear, maxYear] = yearRange.value
        filtered = filtered.filter(pick => pick.year >= minYear && pick.year <= maxYear)
      }
    } else {
      // Single year filter
      if (selectedYear.value !== null) {
        filtered = filtered.filter(pick => pick.year === selectedYear.value)
      }
    }

    // Round filter - handle 3+ option
    if (selectedRounds.value.length > 0) {
      filtered = filtered.filter(pick => {
        return selectedRounds.value.some(round => {
          if (round === '3+') {
            return pick.round >= 3
          }
          return pick.round === round
        })
      })
    }

    // Overall pick range filter
    if (overallPickRange.value && overallPickRange.value.length === 2) {
      const [minOverall, maxOverall] = overallPickRange.value
      filtered = filtered.filter(pick => {
        // Calculate overall pick: (round - 1) * 30 + pick
        const overallPick = (pick.round - 1) * 30 + pick.pick
        if (maxOverall === 61) {
          // If max is 61, it means "no upper limit" - show all picks >= minOverall
          return overallPick >= minOverall
        } else {
          // Normal range filter
          return overallPick >= minOverall && overallPick <= maxOverall
        }
      })
    }

    // Pre-draft team filter - multiple selection
    if (preDraftTeamSearch.value.length > 0) {
      filtered = filtered.filter(pick =>
        pick.preDraftTeam && preDraftTeamSearch.value.includes(pick.preDraftTeam)
      )
    }

    // Trade filter
    if (tradeFilter.value === 'traded') {
      filtered = filtered.filter(pick => pick.draftTrades && pick.draftTrades.trim() !== '')
    } else if (tradeFilter.value === 'not-traded') {
      filtered = filtered.filter(pick => !pick.draftTrades || pick.draftTrades.trim() === '')
    }

    return filtered
  })

  async function loadAllTeamData(teams: TeamAbbreviation[]) {
    loading.value = true
    error.value = null

    try {
      const picks: DraftPick[] = []

      for (const team of teams) {
        try {
          const response = await fetch(getDataUrl(`csv/${team}.csv`))
          if (!response.ok) {
            console.error(`Failed to fetch ${team}.csv:`, response.status)
            continue
          }
          const csvText = await response.text()
          const teamPicks = await parseCSV(csvText, team)
          picks.push(...teamPicks)
        } catch (teamErr) {
          console.error(`Error loading ${team}:`, teamErr)
        }
      }

      allDraftPicks.value = picks
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load draft data'
      console.error('Error loading draft data:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    selectedTeam,
    selectedYear,
    yearRange,
    useYearRange,
    selectedRounds,
    overallPickRange,
    preDraftTeamSearch,
    tradeFilter,
    filteredData,
    allPreDraftTeams,
    availableYears,
    loading,
    error,
    loadAllTeamData
  }
}
