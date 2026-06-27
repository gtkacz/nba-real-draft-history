import { ref, computed, watch } from 'vue'
import type { DraftPick, ForfeitedPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getDataUrl } from '@/utils/dataUrl'
import { loadDataVersion } from '@/composables/useDataVersion'
import { normalizeString } from '@/utils/stringNormalizer'
import { parseHeight } from '@/utils/parseHeight'
import { getCanonicalTeam } from '@/utils/teamAliases'
import { getTradeChainCanonicalTeams } from '@/utils/tradeChain'
import { getCurrentSeasonStartYear } from '@/utils/season'
import { getPlayerStatus } from '@/utils/playerStatus'
import { useCountryData } from '@/composables/useCountryData'
import {
  buildCountryNameToCode,
  resolveDraftCountryCode,
  US_DRAFT_COUNTRY,
} from '@/utils/draftCountry'
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
  DEFAULT_ONCE_OWNED_BY_SCOPE,
  createDefaultExcludeModes,
  type ExcludeModes,
  type OnceOwnedByScope,
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

// Forfeited picks carry no overall slot when the pick was removed from the draft
// entirely. To keep the year/pick sort placing them at the end of their round, a
// null-slot pick is assigned a synthetic value just past the last numbered pick of
// its year+round; a per-row epsilon keeps multiple null-slot forfeits in the same
// round uniquely ordered (and uniquely keyed in the virtualized lists).
const FORFEIT_END_OF_ROUND_OFFSET = 0.5
const FORFEIT_ROW_EPSILON = 0.001

function buildForfeitedPicks(forfeited: ForfeitedPick[], regular: DraftPick[]): DraftPick[] {
  const maxPickByYearRound = new Map<string, number>()
  const maxPickByYear = new Map<number, number>()
  regular.forEach((pick) => {
    const yearRoundKey = `${pick.year}|${pick.round}`
    const yearRoundMax = maxPickByYearRound.get(yearRoundKey)
    if (yearRoundMax === undefined || pick.pick > yearRoundMax) {
      maxPickByYearRound.set(yearRoundKey, pick.pick)
    }
    const yearMax = maxPickByYear.get(pick.year)
    if (yearMax === undefined || pick.pick > yearMax) {
      maxPickByYear.set(pick.year, pick.pick)
    }
  })

  return forfeited.map((entry, index) => {
    const knownPick = typeof entry.pick === 'number' ? entry.pick : null
    let sortPick: number
    if (knownPick !== null) {
      sortPick = knownPick
    } else {
      const base =
        maxPickByYearRound.get(`${entry.year}|${entry.round}`) ??
        maxPickByYear.get(entry.year) ??
        entry.round * PICK_MAX
      sortPick = base + FORFEIT_END_OF_ROUND_OFFSET + index * FORFEIT_ROW_EPSILON
    }

    return withTeamLogo({
      year: entry.year,
      round: entry.round,
      pick: sortPick,
      player: '',
      position: '',
      height: '',
      weight: 0,
      age: 0,
      preDraftTeam: '',
      class: '',
      draftTrades: null,
      yearsOfService: 0,
      team: entry.team,
      nba_id: null,
      origin_country: null,
      played_until_year: null,
      is_defunct: 0,
      plays_for: null,
      awards: {},
      isForfeited: true,
      forfeitReason: entry.reason,
      forfeitSource: entry.source ?? null,
      forfeitDisplayPick: knownPick,
    })
  })
}

// Forfeited picks are an optional, hand-curated dataset; a missing or malformed file
// must not break the primary draft load, so any failure degrades to an empty list.
async function loadForfeitedPicks(
  version: string | null,
  regular: DraftPick[],
): Promise<DraftPick[]> {
  try {
    const response = await fetch(getDataUrl('forfeited_picks.json', version))
    if (!response.ok) {
      return []
    }
    const records = (await response.json()) as ForfeitedPick[]
    if (!Array.isArray(records)) {
      return []
    }
    return buildForfeitedPicks(records, regular)
  } catch (err) {
    console.error('Error loading forfeited picks:', err)
    return []
  }
}

export function useDraftData() {
  const selectedTeam = ref<TeamAbbreviation[]>([])
  const selectedOnceOwnedBy = ref<TeamAbbreviation[]>([])
  const selectedPlaysFor = ref<TeamAbbreviation[]>([])
  const selectedYear = ref<number | null>(null)
  const yearRange = ref<[number, number]>([YEAR_MIN, YEAR_MAX])
  const useYearRange = ref(true)
  const selectedRounds = ref<(number | string)[]>([])
  const overallPickRange = ref<[number, number]>([PICK_MIN, PICK_MAX])
  const preDraftTeamSearch = ref<string[]>([])
  const selectedDraftCountries = ref<string[]>([])
  const selectedPositions = ref<string[]>([])
  const ageRange = ref<[number, number]>([AGE_MIN, AGE_MAX])
  const heightRange = ref<[number, number]>([HEIGHT_MIN, HEIGHT_MAX])
  const weightRange = ref<[number, number]>([WEIGHT_MIN, WEIGHT_MAX])
  const yearsOfServiceRange = ref<[number, number]>([YOS_MIN, YOS_MAX])
  const tradeFilter = ref<'all' | 'traded' | 'not-traded'>('all')
  const retiredFilter = ref<'all' | 'retired' | 'not-retired'>('all')
  const forfeitedFilter = ref<'hide' | 'show' | 'only'>('show')
  const selectedNationalities = ref<string[]>([])
  const selectedAwards = ref<Record<string, number>>({}) // { awardName: minCount }
  const awardFilterMode = ref<'exclusive' | 'inclusive'>('exclusive')
  const playerSearch = ref<string>('')

  // Per-filter negation: when a key is true that membership filter excludes its
  // selected values instead of including them. Each filter is independently
  // regular or negated; the two never apply at once for the same filter.
  const excludeModes = ref<ExcludeModes>(createDefaultExcludeModes())
  const onceOwnedByScope = ref<OnceOwnedByScope>(DEFAULT_ONCE_OWNED_BY_SCOPE)

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

  // Reverse country-name lookup is keyed off the shared country dataset so that
  // newly-added countries resolve automatically without a hardcoded list.
  const { countryDataMap } = useCountryData()
  const countryNameToCode = computed(() => buildCountryNameToCode(Object.keys(countryDataMap.value)))

  // Resolve each distinct pre-draft team once; both the filter and the option
  // list reuse this map instead of re-parsing every pick on every pass.
  const draftCountryByTeam = computed(() => {
    const resolver = countryNameToCode.value
    const map = new Map<string, string>()
    allDraftPicks.value.forEach((pick) => {
      const team = pick.preDraftTeam ?? ''
      if (!map.has(team)) {
        map.set(team, resolveDraftCountryCode(team, resolver))
      }
    })
    return map
  })

  const availableDraftCountries = computed(() => {
    const codes = new Set<string>()
    draftCountryByTeam.value.forEach((code) => codes.add(code))
    return Array.from(codes).sort()
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

  // Forfeited picks possess only year, round, and drafting team, so the include/
  // only modes narrow them by exactly those structural filters (team negation
  // included) and leave the player-attribute filters to the drafted players.
  function matchesStructuralForfeit(pick: DraftPick): boolean {
    if (useYearRange.value) {
      if (yearRange.value && yearRange.value.length === 2) {
        const [minYear, maxYear] = yearRange.value
        if (pick.year < minYear || pick.year > maxYear) return false
      }
    } else if (selectedYear.value !== null) {
      if (pick.year !== selectedYear.value) return false
    }

    if (selectedRounds.value.length > 0) {
      const roundMatch = selectedRounds.value.some((round) =>
        round === '3+' ? pick.round >= 3 : pick.round === round,
      )
      if (!roundMatch) return false
    }

    if (selectedTeam.value.length > 0) {
      const exclude = excludeModes.value.team
      const isMatch = selectedTeam.value.includes(pick.team as TeamAbbreviation)
      if (exclude ? isMatch : !isMatch) return false
    }

    return true
  }

  const filteredData = computed(() => {
    // The player-attribute filter chain operates on drafted players only; forfeited
    // rows are reintroduced afterward according to forfeitedFilter.
    let filtered = allDraftPicks.value.filter((pick) => !pick.isForfeited)

    // Team filter ("Drafted By") - the team is always present, so negation is the
    // plain complement of the selection.
    if (selectedTeam.value.length > 0) {
      const exclude = excludeModes.value.team
      filtered = filtered.filter((pick) => {
        const isMatch = selectedTeam.value.includes(pick.team as TeamAbbreviation)
        return exclude ? !isMatch : isMatch
      })
    }

    // "Once owned by" filter - inspect a pick's trade chain. In 'any' scope the
    // selected team can appear anywhere among the prior owners; in 'first' scope
    // it must be the chain's original owner. Negation flips the match. Picks that
    // were never traded carry no ownership history and so are never returned by
    // this filter, in either mode.
    if (selectedOnceOwnedBy.value.length > 0) {
      const selectedCanonical = selectedOnceOwnedBy.value.map((team) => getCanonicalTeam(team))
      const exclude = excludeModes.value.onceOwnedBy
      const scope = onceOwnedByScope.value
      filtered = filtered.filter((pick) => {
        const chain = getTradeChainCanonicalTeams(pick.draftTrades, pick.year)
        if (chain.length === 0) return false
        const drafter = getCanonicalTeam(pick.team, pick.year)
        let isMatch: boolean
        if (scope === 'first') {
          // The original owner is the head of the chain; ignore the degenerate
          // case where that is also the drafting team.
          const firstOwner = chain[0]
          isMatch =
            firstOwner !== undefined &&
            firstOwner !== drafter &&
            selectedCanonical.includes(firstOwner)
        } else {
          const priorOwners = chain.filter((team) => team !== drafter)
          isMatch = selectedCanonical.some((team) => priorOwners.includes(team))
        }
        return exclude ? !isMatch : isMatch
      })
    }

    // Currently plays for filter - restricted to active players who have a known
    // current team. In include mode that team must be one of the selection; in
    // exclude mode it must be a different team (retired players and players with
    // no current team are outside this filter's domain in both modes).
    if (selectedPlaysFor.value.length > 0) {
      const exclude = excludeModes.value.playsFor
      const seasonStartYear = getCurrentSeasonStartYear()
      filtered = filtered.filter((pick) => {
        if (getPlayerStatus(pick, seasonStartYear) !== 'active') return false

        const playsFor = pick.plays_for?.trim()
        if (!playsFor) return false
        const isMatch = selectedPlaysFor.value.includes(playsFor as TeamAbbreviation)
        return exclude ? !isMatch : isMatch
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

    // Pre-draft team filter ("Drafted From") - restricted to picks with a known
    // pre-draft team; negation keeps those whose team is not in the selection.
    if (preDraftTeamSearch.value.length > 0) {
      const exclude = excludeModes.value.preDraftTeam
      filtered = filtered.filter((pick) => {
        if (!pick.preDraftTeam) return false
        const isMatch = preDraftTeamSearch.value.includes(pick.preDraftTeam)
        return exclude ? !isMatch : isMatch
      })
    }

    // Drafted-from country filter - every pick resolves to a country code (US by
    // default), so negation is the plain complement. Excluding the US therefore
    // yields all non-US origins, which replaces the former "all non-US" umbrella.
    if (selectedDraftCountries.value.length > 0) {
      const exclude = excludeModes.value.draftCountries
      const teamCountry = draftCountryByTeam.value
      filtered = filtered.filter((pick) => {
        const code = teamCountry.get(pick.preDraftTeam ?? '') ?? US_DRAFT_COUNTRY
        const isMatch = selectedDraftCountries.value.includes(code)
        return exclude ? !isMatch : isMatch
      })
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
    // Only narrows the set once the range diverges from its default bounds, so
    // picks with missing/invalid ages are excluded only when the filter is
    // actually applied rather than on every default render.
    if (ageRange.value && ageRange.value.length === 2) {
      const [minAge, maxAge] = ageRange.value
      if (minAge !== AGE_MIN || maxAge !== AGE_MAX) {
        filtered = filtered.filter((pick) => {
          if (!pick.age || pick.age <= 0) return false
          return pick.age >= minAge && pick.age <= maxAge
        })
      }
    }

    // Height range filter
    if (heightRange.value && heightRange.value.length === 2) {
      const [minHeightInches, maxHeightInches] = heightRange.value
      if (minHeightInches !== HEIGHT_MIN || maxHeightInches !== HEIGHT_MAX) {
        filtered = filtered.filter((pick) => {
          if (!pick.height) return false
          const heightInches = parseHeight(pick.height)
          if (heightInches <= 0) return false
          return heightInches >= minHeightInches && heightInches <= maxHeightInches
        })
      }
    }

    // Weight range filter
    if (weightRange.value && weightRange.value.length === 2) {
      const [minWeight, maxWeight] = weightRange.value
      if (minWeight !== WEIGHT_MIN || maxWeight !== WEIGHT_MAX) {
        filtered = filtered.filter((pick) => {
          if (!pick.weight || pick.weight <= 0) return false
          return pick.weight >= minWeight && pick.weight <= maxWeight
        })
      }
    }

    // Years of service range filter
    if (yearsOfServiceRange.value && yearsOfServiceRange.value.length === 2) {
      const [minYears, maxYears] = yearsOfServiceRange.value
      if (minYears !== YOS_MIN || maxYears !== YOS_MAX) {
        filtered = filtered.filter((pick) => {
          if (pick.yearsOfService === undefined) return false
          return pick.yearsOfService >= minYears && pick.yearsOfService <= maxYears
        })
      }
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
        const status = getPlayerStatus(pick, seasonStartYear)
        if (status === 'unknown' || status === 'never-debuted') return false
        const isRetired = status === 'retired'
        if (retiredFilter.value === 'retired') {
          return isRetired
        } else {
          // 'not-retired'
          return !isRetired
        }
      })
    }

    // Nationality filter - restricted to picks with a known nationality; negation
    // keeps those whose nationality is not in the selection.
    if (selectedNationalities.value.length > 0) {
      const exclude = excludeModes.value.nationalities
      filtered = filtered.filter((pick) => {
        if (!pick.origin_country) return false
        const normalizedCountry = pick.origin_country.toLowerCase().trim()
        if (normalizedCountry === '') return false
        const isMatch = selectedNationalities.value.includes(normalizedCountry)
        return exclude ? !isMatch : isMatch
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

    if (forfeitedFilter.value === 'hide') {
      return filtered
    }

    const forfeitedRows = allDraftPicks.value.filter(
      (pick) => pick.isForfeited && matchesStructuralForfeit(pick),
    )

    if (forfeitedFilter.value === 'only') {
      return forfeitedRows
    }

    return [...filtered, ...forfeitedRows]
  })

  async function loadDraftData() {
    loading.value = true
    error.value = null

    try {
      const version = await loadDataVersion()
      const response = await fetch(getDataUrl('draft_history.json', version))
      if (!response.ok) {
        throw new Error(`Failed to fetch draft_history.json: ${response.status}`)
      }

      const records = (await response.json()) as DraftPick[]
      if (!Array.isArray(records)) {
        throw new Error('draft_history.json must contain an array')
      }

      const regular = records.map(withTeamLogo)
      const forfeited = await loadForfeitedPicks(version, regular)
      allDraftPicks.value = [...regular, ...forfeited]
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
    selectedOnceOwnedBy,
    selectedPlaysFor,
    selectedYear,
    yearRange,
    useYearRange,
    selectedRounds,
    overallPickRange,
    preDraftTeamSearch,
    selectedDraftCountries,
    selectedPositions,
    ageRange,
    heightRange,
    weightRange,
    yearsOfServiceRange,
    tradeFilter,
    retiredFilter,
    forfeitedFilter,
    selectedNationalities,
    selectedAwards,
    awardFilterMode,
    excludeModes,
    onceOwnedByScope,
    playerSearch,
    sortBy,
    currentPage,
    itemsPerPage,
    filteredData,
    allPreDraftTeams,
    availableDraftCountries,
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
