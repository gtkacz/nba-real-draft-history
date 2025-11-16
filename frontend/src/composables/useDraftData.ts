import { ref, computed } from 'vue'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { parseCSV } from '@/utils/csvParser'
import { getDataUrl } from '@/utils/dataUrl'
import { getCachedCSV, setCachedCSV, initializeCache } from '@/utils/csvCache'
import { normalizeString } from '@/utils/stringNormalizer'

const allDraftPicks = ref<DraftPick[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// Helper function to parse height strings like "6-8" or "6'8\"" into inches
function parseHeight(height: string | null | undefined): number {
  if (!height) return 0
  const str = String(height).trim()
  
  // Try format "6-8" (feet-inches)
  const match1 = str.match(/(\d+)[-'](\d+)/)
  if (match1 && match1[1] && match1[2]) {
    const feet = parseInt(match1[1], 10)
    const inches = parseInt(match1[2], 10)
    return feet * 12 + inches
  }
  
  // Try format "6'8\"" (feet'inches")
  const match2 = str.match(/(\d+)'(\d+)"/)
  if (match2 && match2[1] && match2[2]) {
    const feet = parseInt(match2[1], 10)
    const inches = parseInt(match2[2], 10)
    return feet * 12 + inches
  }
  
  // Try to parse as just a number (assume inches)
  const num = parseFloat(str)
  if (!isNaN(num)) return num
  
  return 0
}

export function useDraftData() {
  const selectedTeam = ref<TeamAbbreviation[]>([])
  const selectedPlaysFor = ref<TeamAbbreviation[]>([])
  const selectedYear = ref<number | null>(null)
  const yearRange = ref<[number, number]>([1947, 2025])
  const useYearRange = ref(true)
  const selectedRounds = ref<(number | string)[]>([])
  const overallPickRange = ref<[number, number]>([1, 61])
  const preDraftTeamSearch = ref<string[]>([])
  const selectedPositions = ref<string[]>([])
  const ageRange = ref<[number, number]>([17, 50])
  const heightRange = ref<[number, number]>([60, 96]) // Default: 5'0" to 8'0" in inches
  const weightRange = ref<[number, number]>([140, 403]) // Default: 140 to 403 lbs
  const yearsOfServiceRange = ref<[number, number]>([0, 30]) // Default: 0 to 30 years
  const tradeFilter = ref<'all' | 'traded' | 'not-traded'>('all')
  const retiredFilter = ref<'all' | 'retired' | 'not-retired'>('all')
  const selectedNationalities = ref<string[]>([])
  const selectedAwards = ref<Record<string, number>>({}) // { awardName: minCount }
  const awardFilterMode = ref<'exclusive' | 'inclusive'>('exclusive')
  const playerSearch = ref<string>('')

  // Sort state - initial multi-sort by year (desc) and pick (asc)
  type SortItem = { key: string; order: 'asc' | 'desc' }
  const sortBy = ref<SortItem[]>([
    { key: 'year', order: 'desc' },
    { key: 'pick', order: 'asc' },
  ])

  // Pagination state
  const currentPage = ref(1)
  const itemsPerPage = ref(30)

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

  // Compute min/max height and weight from data
  const minHeight = computed(() => {
    let min = 96 // 8'0" default max
    allDraftPicks.value.forEach((pick) => {
      if (pick.height) {
        const heightInches = parseHeight(pick.height)
        if (heightInches > 0 && heightInches < min) {
          min = heightInches
        }
      }
    })
    return min < 96 ? min : 60 // Default to 5'0" if no valid data
  })

  const maxHeight = computed(() => {
    let max = 60 // 5'0" default min
    allDraftPicks.value.forEach((pick) => {
      if (pick.height) {
        const heightInches = parseHeight(pick.height)
        if (heightInches > max) {
          max = heightInches
        }
      }
    })
    return max > 60 ? max : 96 // Default to 8'0" if no valid data
  })

  const minWeight = computed(() => {
    let min = 403 // default max
    allDraftPicks.value.forEach((pick) => {
      if (pick.weight && pick.weight > 0 && pick.weight < min) {
        min = pick.weight
      }
    })
    return min < 403 ? min : 140 // Default to 140 if no valid data
  })

  const maxWeight = computed(() => {
    let max = 140 // default min
    allDraftPicks.value.forEach((pick) => {
      if (pick.weight && pick.weight > max) {
        max = pick.weight
      }
    })
    return max > 140 ? max : 403 // Default to 403 if no valid data
  })

  const minYearsOfService = computed(() => {
    let min = 30 // default max
    allDraftPicks.value.forEach((pick) => {
      if (pick.yearsOfService !== undefined && pick.yearsOfService >= 0 && pick.yearsOfService < min) {
        min = pick.yearsOfService
      }
    })
    return min < 30 ? min : 0 // Default to 0 if no valid data
  })

  const maxYearsOfService = computed(() => {
    let max = 0 // default min
    allDraftPicks.value.forEach((pick) => {
      if (pick.yearsOfService !== undefined && pick.yearsOfService > max) {
        max = pick.yearsOfService
      }
    })
    return max > 0 ? max : 30 // Default to 30 if no valid data
  })

  const filteredData = computed(() => {
    let filtered = allDraftPicks.value

    // Team filter - multiple selection
    if (selectedTeam.value.length > 0) {
      filtered = filtered.filter((pick) => selectedTeam.value.includes(pick.team))
    }

    // Currently plays for filter - multiple selection
    // Only includes active players (excludes retired players)
    if (selectedPlaysFor.value.length > 0) {
      filtered = filtered.filter((pick) => {
        // First check if player is active (not retired)
        const currentYear = new Date().getFullYear()
        const isRetired =
          pick.played_until_year !== undefined && pick.played_until_year < currentYear
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
        if (maxOverallNum === 61) {
          // If max is 61, it means "no upper limit" - show all picks >= minOverall
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
      const currentYear = new Date().getFullYear()
      filtered = filtered.filter((pick) => {
        // Exclude players with unknown retirement status (played_until_year is undefined)
        if (pick.played_until_year === undefined) {
          return false
        }
        const isRetired = pick.played_until_year < currentYear
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
        if (awardFilterMode.value === 'exclusive') {
          // Exclusive mode: player must have ALL selected awards
          return selectedAwardEntries.every(([awardName, minCount]) => {
            const playerCount = pick.awards[awardName]
            return playerCount !== undefined && typeof playerCount === 'number' && playerCount >= minCount
          })
        } else {
          // Inclusive mode: player must have ANY of the selected awards
          return selectedAwardEntries.some(([awardName, minCount]) => {
            const playerCount = pick.awards[awardName]
            return playerCount !== undefined && typeof playerCount === 'number' && playerCount >= minCount
          })
        }
      })
    }

    // Player name search filter (with normalized matching for accents)
    if (playerSearch.value && playerSearch.value.trim() !== '') {
      const searchTerm = normalizeString(playerSearch.value.toLowerCase().trim())
      filtered = filtered.filter((pick) => {
        if (!pick.player) return false
        const normalizedPlayerName = normalizeString(pick.player.toLowerCase())
        return normalizedPlayerName.includes(searchTerm)
      })
    }

    return filtered
  })

  async function loadAllTeamData(teams: TeamAbbreviation[]) {
    loading.value = true
    error.value = null

    // Initialize cache (check version and invalidate if needed)
    initializeCache()

    try {
      const picks: DraftPick[] = []

      for (const team of teams) {
        try {
          let csvText = ''
          let isEnriched = true

          // Try to get from cache first (enriched)
          csvText = getCachedCSV(team, true)

          if (csvText) {
            // Found enriched CSV in cache
            isEnriched = true
          } else {
            // Not in cache, try to fetch enriched CSV
            let response = await fetch(getDataUrl(`csv/${team}_enriched.csv`))

            if (response.ok) {
              csvText = await response.text()
              isEnriched = true

              // Check if we got HTML instead of CSV
              if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
                csvText = ''
              }
            }

            // If enriched CSV not available, try regular CSV
            if (!csvText) {
              // Try cache for regular CSV
              csvText = getCachedCSV(team, false)

              if (csvText) {
                isEnriched = false
              } else {
                // Fetch regular CSV
                response = await fetch(getDataUrl(`csv/${team}.csv`))
                if (!response.ok) {
                  console.error(`Failed to fetch ${team}.csv:`, response.status)
                  continue
                }

                csvText = await response.text()
                isEnriched = false

                // Check if we got HTML instead of CSV
                if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
                  console.error(`Received HTML for ${team}.csv, skipping`)
                  continue
                }
              }
            }

            // Cache the fetched CSV if it came from network
            if (csvText && !getCachedCSV(team, isEnriched)) {
              setCachedCSV(team, isEnriched, csvText)
            }
          }

          if (!csvText) {
            continue
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
    loadAllTeamData,
  }
}
