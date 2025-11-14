import { watch, onMounted, nextTick, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TeamAbbreviation } from '@/types/team'

type SortItem = { key: string; order: 'asc' | 'desc' }

interface FilterDefaults {
  selectedTeam: TeamAbbreviation[]
  selectedYear: number | null
  yearRange: [number, number]
  useYearRange: boolean
  selectedRounds: (number | string)[]
  overallPickRange: [number, number]
  preDraftTeamSearch: string[]
  selectedPositions: string[]
  ageRange: [number, number]
  tradeFilter: 'all' | 'traded' | 'not-traded'
  selectedNationalities: string[]
  sortBy: SortItem[]
  currentPage: number
  itemsPerPage: number
}

const DEFAULT_FILTERS: FilterDefaults = {
  selectedTeam: [],
  selectedYear: null,
  yearRange: [1947, 2025],
  useYearRange: true,
  selectedRounds: [],
  overallPickRange: [1, 61],
  preDraftTeamSearch: [],
  selectedPositions: [],
  ageRange: [17, 50],
  tradeFilter: 'all',
  selectedNationalities: [],
  sortBy: [
    { key: 'year', order: 'desc' },
    { key: 'pick', order: 'asc' }
  ],
  currentPage: 1,
  itemsPerPage: 30
}

export function useFilterUrlSync(
  filters: {
    selectedTeam: Ref<TeamAbbreviation[]>
    selectedYear: Ref<number | null>
    yearRange: Ref<[number, number]>
    useYearRange: Ref<boolean>
    selectedRounds: Ref<(number | string)[]>
    overallPickRange: Ref<[number, number]>
    preDraftTeamSearch: Ref<string[]>
    selectedPositions: Ref<string[]>
    ageRange: Ref<[number, number]>
    tradeFilter: Ref<'all' | 'traded' | 'not-traded'>
    selectedNationalities: Ref<string[]>
    sortBy: Ref<SortItem[]>
    currentPage: Ref<number>
    itemsPerPage: Ref<number>
  }
) {
  const route = useRoute()
  const router = useRouter()
  let isInitializing = true
  let isLoadingFromUrl = false

  // Helper function to check if a value is different from default
  function isNonDefault<T>(value: T, defaultValue: T): boolean {
    if (Array.isArray(value) && Array.isArray(defaultValue)) {
      if (value.length !== defaultValue.length) return true
      // For arrays of objects, use JSON comparison
      return JSON.stringify(value) !== JSON.stringify(defaultValue)
    }
    if (Array.isArray(value) && value.length === 0) return false
    return JSON.stringify(value) !== JSON.stringify(defaultValue)
  }

  // Helper function to serialize array values for URL
  function serializeArray(arr: (string | number)[]): string {
    return arr.join(',')
  }

  // Helper function to deserialize array values from URL
  function deserializeArray(str: string | string[] | undefined, type: 'string' | 'number' | 'mixed' = 'mixed'): (string | number)[] {
    if (!str) return []
    const arr = Array.isArray(str) ? str : [str]
    if (arr.length === 0) return []
    
    // Handle comma-separated values
    const values = arr.flatMap(v => v.split(',').filter(Boolean))
    
    if (type === 'number') {
      return values.map(v => {
        const num = Number(v)
        return isNaN(num) ? 0 : num
      })
    } else if (type === 'string') {
      return values
    } else {
      // Mixed: try to parse as number, fallback to string
      return values.map(v => {
        const num = Number(v)
        return isNaN(num) ? v : num
      })
    }
  }

  // Helper function to deserialize tuple from URL
  function deserializeTuple(str: string | string[] | undefined, defaultValue: [number, number]): [number, number] {
    if (!str) return defaultValue
    const arr = Array.isArray(str) ? str : [str]
    if (arr.length === 0) return defaultValue
    
    // Handle comma-separated values
    const values = arr.flatMap(v => v.split(',').filter(Boolean))
    if (values.length < 2) return defaultValue
    
    const [first, second] = values
    const num1 = Number(first)
    const num2 = Number(second)
    
    if (isNaN(num1) || isNaN(num2)) return defaultValue
    return [num1, num2]
  }

  // Load filters from URL on mount
  function loadFiltersFromUrl() {
    isLoadingFromUrl = true
    const query = route.query

    // If not initializing (i.e., this is a navigation event), reset all filters to defaults first
    if (!isInitializing) {
      filters.selectedTeam.value = [...DEFAULT_FILTERS.selectedTeam]
      filters.selectedYear.value = DEFAULT_FILTERS.selectedYear
      filters.yearRange.value = [...DEFAULT_FILTERS.yearRange]
      filters.useYearRange.value = DEFAULT_FILTERS.useYearRange
      filters.selectedRounds.value = [...DEFAULT_FILTERS.selectedRounds]
      filters.overallPickRange.value = [...DEFAULT_FILTERS.overallPickRange]
      filters.preDraftTeamSearch.value = [...DEFAULT_FILTERS.preDraftTeamSearch]
      filters.selectedPositions.value = [...DEFAULT_FILTERS.selectedPositions]
      filters.ageRange.value = [...DEFAULT_FILTERS.ageRange]
      filters.tradeFilter.value = DEFAULT_FILTERS.tradeFilter
      filters.selectedNationalities.value = [...DEFAULT_FILTERS.selectedNationalities]
      filters.sortBy.value = [...DEFAULT_FILTERS.sortBy]
      filters.currentPage.value = DEFAULT_FILTERS.currentPage
      filters.itemsPerPage.value = DEFAULT_FILTERS.itemsPerPage
    }

    // Load selectedTeam
    if (query.teams) {
      const teams = deserializeArray(query.teams, 'string') as TeamAbbreviation[]
      if (teams.length > 0) {
        filters.selectedTeam.value = teams
      }
    }

    // Load selectedYear
    if (query.year) {
      const year = Number(query.year)
      if (!isNaN(year)) {
        filters.selectedYear.value = year
      }
    }

    // Load yearRange
    if (query.yearRange) {
      const range = deserializeTuple(query.yearRange, DEFAULT_FILTERS.yearRange)
      if (isNonDefault(range, DEFAULT_FILTERS.yearRange)) {
        filters.yearRange.value = range
      }
    }

    // Load useYearRange
    if (query.useYearRange !== undefined) {
      filters.useYearRange.value = query.useYearRange === 'true' || query.useYearRange === '1'
    }

    // Load selectedRounds
    if (query.rounds) {
      const rounds = deserializeArray(query.rounds, 'mixed')
      if (rounds.length > 0) {
        filters.selectedRounds.value = rounds
      }
    }

    // Load overallPickRange
    if (query.pickRange) {
      const range = deserializeTuple(query.pickRange, DEFAULT_FILTERS.overallPickRange)
      if (isNonDefault(range, DEFAULT_FILTERS.overallPickRange)) {
        filters.overallPickRange.value = range
      }
    }

    // Load preDraftTeamSearch
    if (query.preDraftTeams) {
      const teams = deserializeArray(query.preDraftTeams, 'string')
      if (teams.length > 0) {
        filters.preDraftTeamSearch.value = teams as string[]
      }
    }

    // Load selectedPositions
    if (query.positions) {
      const positions = deserializeArray(query.positions, 'string')
      if (positions.length > 0) {
        filters.selectedPositions.value = positions as string[]
      }
    }

    // Load ageRange
    if (query.ageRange) {
      const range = deserializeTuple(query.ageRange, DEFAULT_FILTERS.ageRange)
      if (isNonDefault(range, DEFAULT_FILTERS.ageRange)) {
        filters.ageRange.value = range
      }
    }

    // Load tradeFilter
    if (query.tradeFilter && (query.tradeFilter === 'traded' || query.tradeFilter === 'not-traded' || query.tradeFilter === 'all')) {
      filters.tradeFilter.value = query.tradeFilter as 'all' | 'traded' | 'not-traded'
    }

    // Load selectedNationalities
    if (query.nationalities) {
      const nationalities = deserializeArray(query.nationalities, 'string')
      if (nationalities.length > 0) {
        filters.selectedNationalities.value = nationalities as string[]
      }
    }

    // Load sortBy
    if (query.sortBy) {
      const sortByStr = Array.isArray(query.sortBy) ? query.sortBy[0] : query.sortBy
      if (typeof sortByStr === 'string') {
        try {
          // Format: "key:order,key:order" or JSON array
          // Try JSON first
          const parsed = JSON.parse(sortByStr)
          if (Array.isArray(parsed) && parsed.every((item: any) => item.key && item.order)) {
            filters.sortBy.value = parsed as SortItem[]
          }
        } catch {
          // If JSON parsing fails, try simple format "key:order,key:order"
          const sortItems: SortItem[] = []
          const parts = sortByStr.split(',')
          for (const part of parts) {
            const [key, order] = part.split(':')
            if (key && (order === 'asc' || order === 'desc')) {
              sortItems.push({ key: key.trim(), order: order.trim() as 'asc' | 'desc' })
            }
          }
          if (sortItems.length > 0) {
            filters.sortBy.value = sortItems
          }
        }
      }
    }

    // Load page (currentPage)
    if (query.page) {
      const page = Number(query.page)
      if (!isNaN(page) && page >= 1) {
        filters.currentPage.value = page
      }
    }

    // Load limit (itemsPerPage)
    if (query.limit) {
      const limit = Number(query.limit)
      if (!isNaN(limit) && limit > 0) {
        filters.itemsPerPage.value = limit
      }
    }

    // Use nextTick to ensure all reactive updates are processed before allowing URL updates
    nextTick(() => {
      isLoadingFromUrl = false
    })
  }

  // Update URL query strings when filters change
  function updateUrlFromFilters() {
    if (isInitializing || isLoadingFromUrl) return

    const query: Record<string, string> = {}

    // Only add non-default filters to URL
    if (isNonDefault(filters.selectedTeam.value, DEFAULT_FILTERS.selectedTeam)) {
      query.teams = serializeArray(filters.selectedTeam.value)
    }

    if (filters.selectedYear.value !== null && filters.selectedYear.value !== DEFAULT_FILTERS.selectedYear) {
      query.year = String(filters.selectedYear.value)
    }

    if (isNonDefault(filters.yearRange.value, DEFAULT_FILTERS.yearRange)) {
      query.yearRange = serializeArray(filters.yearRange.value)
    }

    if (filters.useYearRange.value !== DEFAULT_FILTERS.useYearRange) {
      query.useYearRange = String(filters.useYearRange.value)
    }

    if (isNonDefault(filters.selectedRounds.value, DEFAULT_FILTERS.selectedRounds)) {
      query.rounds = serializeArray(filters.selectedRounds.value)
    }

    if (isNonDefault(filters.overallPickRange.value, DEFAULT_FILTERS.overallPickRange)) {
      query.pickRange = serializeArray(filters.overallPickRange.value)
    }

    if (isNonDefault(filters.preDraftTeamSearch.value, DEFAULT_FILTERS.preDraftTeamSearch)) {
      query.preDraftTeams = serializeArray(filters.preDraftTeamSearch.value)
    }

    if (isNonDefault(filters.selectedPositions.value, DEFAULT_FILTERS.selectedPositions)) {
      query.positions = serializeArray(filters.selectedPositions.value)
    }

    if (isNonDefault(filters.ageRange.value, DEFAULT_FILTERS.ageRange)) {
      query.ageRange = serializeArray(filters.ageRange.value)
    }

    if (filters.tradeFilter.value !== DEFAULT_FILTERS.tradeFilter) {
      query.tradeFilter = filters.tradeFilter.value
    }

    if (isNonDefault(filters.selectedNationalities.value, DEFAULT_FILTERS.selectedNationalities)) {
      query.nationalities = serializeArray(filters.selectedNationalities.value)
    }

    // Only add sortBy if it's different from default
    if (isNonDefault(filters.sortBy.value, DEFAULT_FILTERS.sortBy)) {
      // Serialize as JSON for complex structure
      query.sortBy = JSON.stringify(filters.sortBy.value)
    }

    // Only add page if it's different from default
    if (filters.currentPage.value !== DEFAULT_FILTERS.currentPage) {
      query.page = String(filters.currentPage.value)
    }

    // Only add limit if it's different from default
    if (filters.itemsPerPage.value !== DEFAULT_FILTERS.itemsPerPage) {
      query.limit = String(filters.itemsPerPage.value)
    }

    // Update URL without triggering navigation
    router.replace({ query })
  }

  // Watch all filters and update URL
  watch(
    () => [
      filters.selectedTeam.value,
      filters.selectedYear.value,
      filters.yearRange.value,
      filters.useYearRange.value,
      filters.selectedRounds.value,
      filters.overallPickRange.value,
      filters.preDraftTeamSearch.value,
      filters.selectedPositions.value,
      filters.ageRange.value,
      filters.tradeFilter.value,
      filters.selectedNationalities.value,
      filters.sortBy.value,
      filters.currentPage.value,
      filters.itemsPerPage.value
    ],
    () => {
      updateUrlFromFilters()
    },
    { deep: true }
  )

  // Watch route query changes (for browser back/forward navigation)
  watch(
    () => route.query,
    () => {
      if (!isInitializing) {
        loadFiltersFromUrl()
      }
    },
    { deep: true }
  )

  // Load filters from URL on mount
  onMounted(() => {
    loadFiltersFromUrl()
    isInitializing = false
  })
}

