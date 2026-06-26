import { ref, computed, watch } from 'vue'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getDataUrl } from '@/utils/dataUrl'
import { normalizeString } from '@/utils/stringNormalizer'
import { parseHeight } from '@/utils/parseHeight'
import { getCurrentSeasonStartYear } from '@/utils/season'
import {
  YEAR_MIN,
  YEAR_MAX,
  PICK_MIN,
  PICK_MAX,
  AGE_MIN,
  AGE_MAX,
  HEIGHT_MIN,
  HEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_MAX,
  YOS_MIN,
  YOS_MAX,
  DEFAULT_ITEMS_PER_PAGE,
} from '@/constants/filters'

const allDraftPicks = ref<DraftPick[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

function withTeamLogo(pick: DraftPick): DraftPick {
  return {
    ...pick,
    draftTrades: pick.draftTrades ?? null,
    teamLogo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${pick.team.toLowerCase()}.svg`,
  }
}

export function useDraftData() {
  const selectedTeam = ref<TeamAbbreviation[]>([])
  const selectedPlaysFor = ref<TeamAbbreviation[]>([])
  const selectedYear = ref<number | null>(null)
  const yearRange = ref<[number, number]>([YEAR_MIN, YEAR_MAX])
  const useYearRange = ref(true)
  const selectedRounds = ref<(number | string)[]>([])
  const overallPickRange = ref<[number, number]>([PICK_MIN, PICK_MAX])
  const preDraftTeamSearch = ref<string[]>([])
  const selectedPositions = ref<string[]>([])
  const ageRange = ref<[number, number]>([AGE_MIN, AGE_MAX])
  const heightRange = ref<[number, number]>([HEIGHT_MIN, HEIGHT_MAX])
  const weightRange = ref<[number, number]>([WEIGHT_MIN, WEIGHT_MAX])
  const yearsOfServiceRange = ref<[number, number]>([YOS_MIN, YOS_MAX])
  const tradeFilter = ref<'all' | 'traded' | 'not-traded'>('all')
  const retiredFilter = ref<'all' | 'retired' | 'not-retired'>('all')
  const selectedNationalities = ref<string[]>([])
  const selectedAwards = ref<Record<string, number>>({}) // { awardName: minCount }
  const awardFilterMode = ref<'exclusive' | 'inclusive'>('exclusive')
  const playerSearch = ref<string>('')

  // Debounced version of playerSearch to avoid filtering on every keystroke
  const debouncedPlayerSearch = ref<string>(playerSearch.value)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  watch(playerSearch, (val) => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedPlayerSearch.value = val
    }, 250)
  })

  // Sort state - initial multi-sort by year (desc) and pick (asc)
  type SortItem = { key: string; order: 'asc' | 'desc' }
  const sortBy = ref<SortItem[]>([
    { key: 'year', order: 'desc' },
    { key: 'pick', order: 'asc' },
  ])

  // Pagination state
  const currentPage = ref(1)
  const itemsPerPage = ref(DEFAULT_ITEMS_PER_PAGE)

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

  const availableNationalities = computed(() => {
    const nationalities = new Set<string>()
    allDraftPicks.value.forEach((pick) => {
      if (pick.origin_country && pick.origin_country.trim() !== '') {
        nationalities.add(pick.origin_country.toLowerCase().trim())
      }
    })
    return Array.from(nationalities).sort()
  })

  const availableAwards = computed(() => {
    const awards = new Set<string>()
    allDraftPicks.value.forEach((pick) => {
      if (pick.awards && typeof pick.awards === 'object') {
        Object.keys(pick.awards).forEach((awardName) => {
          if (awardName && awardName.trim() !== '') {
            awards.add(awardName)
          }
        })
      }
    })
    return Array.from(awards).sort()
  })

  // Single pass over allDraftPicks to derive all physical stat bounds
  const _physicalBounds = computed(() => {
    let minH = HEIGHT_MAX
    let maxH = HEIGHT_MIN
    let minW = WEIGHT_MAX
    let maxW = WEIGHT_MIN
    let minY = YOS_MAX
    let maxY = YOS_MIN

    allDraftPicks.value.forEach((pick) => {
      if (pick.height) {
        const h = parseHeight(pick.height)
        if (h > 0) {
          if (h < minH) minH = h
          if (h > maxH) maxH = h
        }
      }
      if (pick.weight && pick.weight > 0) {
        if (pick.weight < minW) minW = pick.weight
        if (pick.weight > maxW) maxW = pick.weight
      }
      if (pick.yearsOfService !== undefined && pick.yearsOfService >= 0) {
        if (pick.yearsOfService < minY) minY = pick.yearsOfService
        if (pick.yearsOfService > maxY) maxY = pick.yearsOfService
      }
    })

    return {
      minHeight: minH < HEIGHT_MAX ? minH : HEIGHT_MIN,
      maxHeight: maxH > HEIGHT_MIN ? maxH : HEIGHT_MAX,
      minWeight: minW < WEIGHT_MAX ? minW : WEIGHT_MIN,
      maxWeight: maxW > WEIGHT_MIN ? maxW : WEIGHT_MAX,
      minYearsOfService: minY < YOS_MAX ? minY : YOS_MIN,
      maxYearsOfService: maxY > YOS_MIN ? maxY : YOS_MAX,
    }
  })

  const minHeight = computed(() => _physicalBounds.value.minHeight)
  const maxHeight = computed(() => _physicalBounds.value.maxHeight)
  const minWeight = computed(() => _physicalBounds.value.minWeight)
  const maxWeight = computed(() => _physicalBounds.value.maxWeight)
  const minYearsOfService = computed(() => _physicalBounds.value.minYearsOfService)
  const maxYearsOfService = computed(() => _physicalBounds.value.maxYearsOfService)

  const filteredData = computed(() => {
    let filtered = allDraftPicks.value

    // Team filter - multiple selection
    if (selectedTeam.value.length > 0) {
      filtered = filtered.filter((pick) => selectedTeam.value.includes(pick.team as TeamAbbreviation))
    }

    // Currently plays for filter - multiple selection
    // Only includes active players (excludes retired players)
    if (selectedPlaysFor.value.length > 0) {
      filtered = filtered.filter((pick) => {
        // First check if player is active (not retired)
        const seasonStartYear = getCurrentSeasonStartYear()
        const isRetired =
          pick.played_until_year !== undefined && pick.played_until_year < seasonStartYear
        if (isRetired) return false

        // Check if plays_for exists, is not empty, and matches one of the selected teams
        const playsFor = pick.plays_for?.trim()
        if (playsFor && playsFor !== '') {
          return selectedPlaysFor.value.includes(playsFor as TeamAbbreviation)
        }
        return false
      })
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
      // Explicitly convert to numbers to ensure proper comparison
      const minOverallNum = Number(minOverall)
      const maxOverallNum = Number(maxOverall)
      filtered = filtered.filter((pick) => {
        // pick.pick already contains the overall pick number (not the pick within the round)
        // Explicitly convert to number to ensure proper comparison
        const overallPick = Number(pick.pick)
        if (maxOverallNum === PICK_MAX) {
          // If max is PICK_MAX, it means "no upper limit" - show all picks >= minOverall
          return overallPick >= minOverallNum
        } else {
          // Normal range filter - use <= to include the upper bound
          return overallPick >= minOverallNum && overallPick <= maxOverallNum
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

    // Height range filter
    if (heightRange.value && heightRange.value.length === 2) {
      const [minHeightInches, maxHeightInches] = heightRange.value
      filtered = filtered.filter((pick) => {
        if (!pick.height) return false
        const heightInches = parseHeight(pick.height)
        if (heightInches <= 0) return false
        return heightInches >= minHeightInches && heightInches <= maxHeightInches
      })
    }

    // Weight range filter
    if (weightRange.value && weightRange.value.length === 2) {
      const [minWeight, maxWeight] = weightRange.value
      filtered = filtered.filter((pick) => {
        if (!pick.weight || pick.weight <= 0) return false
        return pick.weight >= minWeight && pick.weight <= maxWeight
      })
    }

    // Years of service range filter
    if (yearsOfServiceRange.value && yearsOfServiceRange.value.length === 2) {
      const [minYears, maxYears] = yearsOfServiceRange.value
      filtered = filtered.filter((pick) => {
        if (pick.yearsOfService === undefined) return false
        return pick.yearsOfService >= minYears && pick.yearsOfService <= maxYears
      })
    }

    // Trade filter
    if (tradeFilter.value === 'traded') {
      filtered = filtered.filter((pick) => pick.draftTrades && pick.draftTrades.trim() !== '')
    } else if (tradeFilter.value === 'not-traded') {
      filtered = filtered.filter((pick) => !pick.draftTrades || pick.draftTrades.trim() === '')
    }

    // Retired filter
    if (retiredFilter.value !== 'all') {
      const seasonStartYear = getCurrentSeasonStartYear()
      filtered = filtered.filter((pick) => {
        // Exclude players with unknown retirement status (played_until_year is undefined)
        if (pick.played_until_year === undefined) {
          return false
        }
        const isRetired = pick.played_until_year < seasonStartYear
        if (retiredFilter.value === 'retired') {
          return isRetired
        } else {
          // 'not-retired'
          return !isRetired
        }
      })
    }

    // Nationality filter - multiple selection
    if (selectedNationalities.value.length > 0) {
      filtered = filtered.filter((pick) => {
        if (!pick.origin_country) return false
        const normalizedCountry = pick.origin_country.toLowerCase().trim()
        return selectedNationalities.value.includes(normalizedCountry)
      })
    }

    // Awards filter - check each selected award with its specific minimum count
    const selectedAwardEntries = Object.entries(selectedAwards.value)
    if (selectedAwardEntries.length > 0) {
      filtered = filtered.filter((pick) => {
        if (!pick.awards || typeof pick.awards !== 'object') return false
        const pickAwards = pick.awards
        if (awardFilterMode.value === 'exclusive') {
          // Exclusive mode: player must have ALL selected awards
          return selectedAwardEntries.every(([awardName, minCount]) => {
            const playerCount = pickAwards[awardName]
            return playerCount !== undefined && typeof playerCount === 'number' && playerCount >= minCount
          })
        } else {
          // Inclusive mode: player must have ANY of the selected awards
          return selectedAwardEntries.some(([awardName, minCount]) => {
            const playerCount = pickAwards[awardName]
            return playerCount !== undefined && typeof playerCount === 'number' && playerCount >= minCount
          })
        }
      })
    }

    // Player name search filter (with normalized matching for accents)
    if (debouncedPlayerSearch.value && debouncedPlayerSearch.value.trim() !== '') {
      const searchTerm = normalizeString(debouncedPlayerSearch.value.toLowerCase().trim())
      filtered = filtered.filter((pick) => {
        if (!pick.player) return false
        const normalizedPlayerName = normalizeString(pick.player.toLowerCase())
        return normalizedPlayerName.includes(searchTerm)
      })
    }

    return filtered
  })

  async function loadDraftData() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(getDataUrl('draft_history.json'))
      if (!response.ok) {
        throw new Error(`Failed to fetch draft_history.json: ${response.status}`)
      }

      const records = (await response.json()) as DraftPick[]
      if (!Array.isArray(records)) {
        throw new Error('draft_history.json must contain an array')
      }

      allDraftPicks.value = records.map(withTeamLogo)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load draft data'
      console.error('Error loading draft data:', err)
      allDraftPicks.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    selectedTeam,
    selectedPlaysFor,
    selectedYear,
    yearRange,
    useYearRange,
    selectedRounds,
    overallPickRange,
    preDraftTeamSearch,
    selectedPositions,
    ageRange,
    heightRange,
    weightRange,
    yearsOfServiceRange,
    tradeFilter,
    retiredFilter,
    selectedNationalities,
    selectedAwards,
    awardFilterMode,
    playerSearch,
    sortBy,
    currentPage,
    itemsPerPage,
    filteredData,
    allPreDraftTeams,
    availableYears,
    availableAges,
    availableNationalities,
    availableAwards,
    minHeight,
    maxHeight,
    minWeight,
    maxWeight,
    minYearsOfService,
    maxYearsOfService,
    loading,
    error,
    loadDraftData,
  }
}
