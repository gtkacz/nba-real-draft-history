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
  const selectedPositions = ref<string[]>([])
  const ageRange = ref<[number, number]>([17, 50])
  const tradeFilter = ref<'all' | 'traded' | 'not-traded'>('all')

  const allPreDraftTeams = computed(() => {
    const teams = new Set<string>()
    allDraftPicks.value.forEach((pick) => {
      if (pick.preDraftTeam && pick.preDraftTeam.trim() !== '') {
        teams.add(pick.preDraftTeam)
      }
    })
    return Array.from(teams).sort()
  })

  const availableYears = computed(() => {
    const years = new Set<number>()
    allDraftPicks.value.forEach((pick) => years.add(pick.year))
    return Array.from(years).sort((a, b) => b - a) // Sort descending
  })

  const availableAges = computed(() => {
    const ages = new Set<number>()
    allDraftPicks.value.forEach((pick) => {
      if (pick.age && pick.age > 0) {
        ages.add(pick.age)
      }
    })
    return Array.from(ages).sort((a, b) => a - b)
  })

  const filteredData = computed(() => {
    let filtered = allDraftPicks.value

    // Team filter - multiple selection
    if (selectedTeam.value.length > 0) {
      filtered = filtered.filter((pick) => selectedTeam.value.includes(pick.team))
    }

    // Year filter
    if (useYearRange.value) {
      // Year range filter
      if (yearRange.value && yearRange.value.length === 2) {
        const [minYear, maxYear] = yearRange.value
        filtered = filtered.filter((pick) => pick.year >= minYear && pick.year <= maxYear)
      }
    } else {
      // Single year filter
      if (selectedYear.value !== null) {
        filtered = filtered.filter((pick) => pick.year === selectedYear.value)
      }
    }

    // Round filter - handle 3+ option
    if (selectedRounds.value.length > 0) {
      filtered = filtered.filter((pick) => {
        return selectedRounds.value.some((round) => {
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
      filtered = filtered.filter((pick) => {
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
      filtered = filtered.filter(
        (pick) => pick.preDraftTeam && preDraftTeamSearch.value.includes(pick.preDraftTeam),
      )
    }

    // Position filter - check if any selected position matches the pick's position
    if (selectedPositions.value.length > 0) {
      filtered = filtered.filter((pick) => {
        if (!pick.position || pick.position.trim() === '') return false
        // Remove "S" and "P" prefixes and split into individual letters
        const normalizedPosition = pick.position.replace(/^[SP]/g, '')
        const positionLetters = normalizedPosition
          .trim()
          .split('')
          .filter((char) => char.match(/[A-Z]/))
        // Check if any selected position matches any letter in the pick's position
        return selectedPositions.value.some((selectedPos) => positionLetters.includes(selectedPos))
      })
    }

    // Age range filter
    if (ageRange.value && ageRange.value.length === 2) {
      const [minAge, maxAge] = ageRange.value
      filtered = filtered.filter((pick) => {
        if (!pick.age || pick.age <= 0) return false
        return pick.age >= minAge && pick.age <= maxAge
      })
    }

    // Trade filter
    if (tradeFilter.value === 'traded') {
      filtered = filtered.filter((pick) => pick.draftTrades && pick.draftTrades.trim() !== '')
    } else if (tradeFilter.value === 'not-traded') {
      filtered = filtered.filter((pick) => !pick.draftTrades || pick.draftTrades.trim() === '')
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
          // Try enriched CSV first, fall back to regular CSV if not found
          let response = await fetch(getDataUrl(`csv/${team}_enriched.csv`))
          let csvText = ''

          if (!response.ok) {
            // If enriched CSV doesn't exist, try regular CSV
            console.log(`Enriched CSV not found for ${team}, trying regular CSV`)
            response = await fetch(getDataUrl(`csv/${team}.csv`))
            if (!response.ok) {
              console.error(`Failed to fetch ${team}.csv:`, response.status)
              continue
            }
          }

          csvText = await response.text()

          // Check if we got HTML instead of CSV (404 page, error page, etc.)
          if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
            console.error(`Received HTML instead of CSV for ${team}, trying regular CSV file`)
            // Try regular CSV
            response = await fetch(getDataUrl(`csv/${team}.csv`))
            if (!response.ok) {
              console.error(`Failed to fetch ${team}.csv:`, response.status)
              continue
            }
            csvText = await response.text()
            if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
              console.error(`Received HTML for ${team}.csv as well, skipping`)
              continue
            }
          }

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
    selectedPositions,
    ageRange,
    tradeFilter,
    filteredData,
    allPreDraftTeams,
    availableYears,
    availableAges,
    loading,
    error,
    loadAllTeamData,
  }
}
