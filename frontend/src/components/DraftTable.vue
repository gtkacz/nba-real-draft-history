<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getCanonicalTeam, getDisplayTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { exportDraftPicksToCSV, downloadCSV as downloadCSVFile } from '@/utils/csvExporter'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { useCountryData } from '@/composables/useCountryData'
import { useTeamData } from '@/composables/useTeamData'
import PlayerCard from './PlayerCard.vue'
import MobileDraftCard from './MobileDraftCard.vue'

const display = useDisplay()
const isMobile = computed(() => display.mobile.value)
const { getFormattedCountryName } = useCountryData()
const { loadTeamData, getTeamFullName, getAllTeamAbbreviations } = useTeamData()

type SortItem = { key: string; order: 'asc' | 'desc' }

interface DraftTableProps {
  data: DraftPick[]
  loading?: boolean
  selectedTeam?: TeamAbbreviation[]
  selectedPlaysFor?: TeamAbbreviation[]
  yearRange?: [number, number]
  selectedYear?: number | null
  useYearRange?: boolean
  selectedRounds?: (number | string)[]
  overallPickRange?: [number, number]
  preDraftTeamSearch?: string[]
  selectedPositions?: string[]
  ageRange?: [number, number]
  heightRange?: [number, number]
  weightRange?: [number, number]
  yearsOfServiceRange?: [number, number]
  tradeFilter?: 'all' | 'traded' | 'not-traded'
  retiredFilter?: 'all' | 'retired' | 'not-retired'
  selectedNationalities?: string[]
  selectedAwards?: Record<string, number>
  awardFilterMode?: 'exclusive' | 'inclusive'
  playerSearch?: string
  sortBy?: SortItem[]
  currentPage?: number
  itemsPerPage?: number
  availableYears?: number[]
  allPreDraftTeams?: string[]
  availableAges?: number[]
  availableNationalities?: string[]
  availableAwards?: string[]
  minHeight?: number
  maxHeight?: number
  minWeight?: number
  maxWeight?: number
  minYearsOfService?: number
  maxYearsOfService?: number
  showPlayerMeasurements?: boolean
  resetFilters?: () => void
}

const props = withDefaults(defineProps<DraftTableProps>(), {
  loading: false,
  selectedTeam: () => [],
  selectedPlaysFor: () => [],
  yearRange: () => [1947, 2025],
  selectedYear: null,
  useYearRange: () => true,
  selectedRounds: () => [],
  overallPickRange: () => [1, 61],
  preDraftTeamSearch: () => [],
  selectedPositions: () => [],
  ageRange: () => [17, 50],
  heightRange: () => [60, 96],
  weightRange: () => [140, 403],
  yearsOfServiceRange: () => [0, 30],
  tradeFilter: () => 'all',
  retiredFilter: () => 'all',
  selectedNationalities: () => [],
  selectedAwards: () => ({}),
  awardFilterMode: () => 'exclusive',
  playerSearch: '',
  sortBy: () => [
    { key: 'year', order: 'desc' },
    { key: 'pick', order: 'asc' }
  ],
  currentPage: 1,
  itemsPerPage: 30,
  availableYears: () => [],
  allPreDraftTeams: () => [],
  availableAges: () => [],
  availableNationalities: () => [],
  availableAwards: () => [],
  minHeight: 60,
  maxHeight: 96,
  minWeight: 140,
  maxWeight: 403,
  minYearsOfService: 0,
  maxYearsOfService: 30,
  showPlayerMeasurements: false,
  resetFilters: undefined
})

const emit = defineEmits<{
  'update:selectedTeam': [value: TeamAbbreviation[]]
  'update:selectedPlaysFor': [value: TeamAbbreviation[]]
  'update:yearRange': [value: [number, number]]
  'update:selectedYear': [value: number | null]
  'update:useYearRange': [value: boolean]
  'update:selectedRounds': [value: (number | string)[]]
  'update:overallPickRange': [value: [number, number]]
  'update:preDraftTeamSearch': [value: string[]]
  'update:selectedPositions': [value: string[]]
  'update:ageRange': [value: [number, number]]
  'update:heightRange': [value: [number, number]]
  'update:weightRange': [value: [number, number]]
  'update:yearsOfServiceRange': [value: [number, number]]
  'update:tradeFilter': [value: 'all' | 'traded' | 'not-traded']
  'update:retiredFilter': [value: 'all' | 'retired' | 'not-retired']
  'update:selectedNationalities': [value: string[]]
  'update:selectedAwards': [value: Record<string, number>]
  'update:awardFilterMode': [value: 'exclusive' | 'inclusive']
  'update:playerSearch': [value: string]
  'update:sortBy': [value: SortItem[]]
  'update:currentPage': [value: number]
  'update:itemsPerPage': [value: number]
  'update:showPlayerMeasurements': [value: boolean]
}>()

const filterMenu = ref(false)
const actionsMenu = ref(false)
const teams = ref<TeamAbbreviation[]>([])
const loadingTeams = ref(true)

// Share functionality
const shareSnackbar = ref(false)
const shareSnackbarText = ref('')

async function copyUrlToClipboard() {
  try {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    shareSnackbarText.value = 'URL copied to clipboard!'
    shareSnackbar.value = true
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = window.location.href
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
      shareSnackbarText.value = 'URL copied to clipboard!'
      shareSnackbar.value = true
    } catch {
      shareSnackbarText.value = 'Failed to copy URL'
      shareSnackbar.value = true
    }
  }
}

// CSV download functionality
function downloadCSV() {
  try {
    const csvContent = exportDraftPicksToCSV(items.value)
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const filename = `nba_draft_data_${date}.csv`
    downloadCSVFile(csvContent, filename)
    shareSnackbarText.value = 'CSV downloaded successfully!'
    shareSnackbar.value = true
  } catch (error) {
    console.error('Failed to download CSV:', error)
    shareSnackbarText.value = 'Failed to download CSV'
    shareSnackbar.value = true
  }
}

// Pagination - use props with computed for two-way binding
const currentPage = computed({
  get: () => props.currentPage ?? 1,
  set: (value) => emit('update:currentPage', value)
})

const itemsPerPage = computed({
  get: () => props.itemsPerPage ?? 30,
  set: (value) => emit('update:itemsPerPage', value)
})

const playerSearch = computed({
  get: () => props.playerSearch ?? '',
  set: (value) => emit('update:playerSearch', value)
})

interface TeamOption {
  value: TeamAbbreviation
  title: string
  logo?: string
}

const teamOptions = ref<TeamOption[]>([])
const roundOptions = [
  { value: 1, title: 'Round 1' },
  { value: 2, title: 'Round 2' },
  { value: '3+', title: 'Round 3+' }
]

interface NationalityOption {
  value: string
  title: string
  flag?: string
}

const awardOptions = computed(() => {
  if (!props.availableAwards || props.availableAwards.length === 0) {
    return []
  }
  return props.availableAwards.map(award => ({
    value: award,
    title: award
  }))
})

function handleAwardCheckboxChange(award: string, checked: boolean) {
  const current = { ...(props.selectedAwards || {}) }
  if (checked) {
    // For one-time-only awards (All-Rookie variants), don't set a count
    // They're just boolean filters
    if (shouldShowAwardCount(award)) {
      current[award] = 1 // Default to 1 for awards that need counts
    } else {
      current[award] = 1 // Still set to 1 for filtering logic, but won't show input
    }
  } else {
    delete current[award]
  }
  emit('update:selectedAwards', current)
}

function handleAwardCountChange(award: string, count: number) {
  if (count < 1) return
  const current = { ...(props.selectedAwards || {}) }
  current[award] = count
  emit('update:selectedAwards', current)
}

// Format award names for display (keeping NBA prefix)
function formatAwardName(award: string): string {
  return award
}

// Sort awards alphabetically
const sortedAwards = computed(() => {
  if (!props.availableAwards || props.availableAwards.length === 0) {
    return []
  }
  return [...props.availableAwards].sort()
})

// Check if award should show count selector (exclude one-time-only awards like All-Rookie variants)
function shouldShowAwardCount(award: string): boolean {
  const awardLower = award.toLowerCase()
  return !awardLower.includes('all-rookie')
}

const nationalityOptions = computed<NationalityOption[]>(() => {
  return props.availableNationalities.map((cca2) => ({
    value: cca2,
    title: getFormattedCountryName(cca2),
    flag: cca2
  })).sort((a, b) => a.title.localeCompare(b.title))
})

const positionOptions = [
  { value: 'G', title: 'Guard (G)' },
  { value: 'F', title: 'Forward (F)' },
  { value: 'C', title: 'Center (C)' }
]

const minAge = computed(() => props.availableAges.length > 0 ? Math.min(...props.availableAges) : 17)
const maxAge = computed(() => props.availableAges.length > 0 ? Math.max(...props.availableAges) : 50)

const minYearsOfService = computed(() => props.minYearsOfService || 0)
const maxYearsOfService = computed(() => props.maxYearsOfService || 30)

// Helper function to format height from inches to feet-inches
function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12)
  const remainingInches = Math.round(inches % 12)
  return `${feet}'${remainingInches}"`
}

const minYear = computed(() => props.availableYears.length > 0 ? Math.min(...props.availableYears) : 1947)
const maxYear = computed(() => props.availableYears.length > 0 ? Math.max(...props.availableYears) : 2025)

async function loadTeams() {
  try {
    await loadTeamData()
    const data = getAllTeamAbbreviations()
    teams.value = data

    teamOptions.value = data.map((abbr) => ({
      value: abbr,
      title: getTeamFullName(abbr),
      logo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${abbr.toLowerCase()}.svg`
    }))
  } catch (error) {
    console.error('Failed to load teams:', error)
  } finally {
    loadingTeams.value = false
  }
}


const allHeaders = [
  { title: 'Team', key: 'team', sortable: true, minWidth: '40px' },
  { title: 'Player', key: 'player', sortable: true, minWidth: '75px' },
  { title: 'Year', key: 'year', sortable: true, width: '80px' },
  { title: 'Round', key: 'round', sortable: true, width: '80px' },
  { title: 'Overall Pick', key: 'pick', sortable: true, width: '35px' },
  { title: 'Position', key: 'position', sortable: true, width: '35px' },
  { 
    title: 'Draft Height', 
    key: 'height', 
    sortable: true, 
    width: '35px',
    sort: (a: DraftPick, b: DraftPick): number => {
      const aHeight = parseHeight(a.height)
      const bHeight = parseHeight(b.height)
      // Handle invalid heights (0 means parsing failed)
      if (aHeight === 0 && bHeight === 0) return 0
      if (aHeight === 0) return 1  // Put invalid heights at the end
      if (bHeight === 0) return -1 // Put invalid heights at the end
      // Compare numerically
      return aHeight - bHeight
    }
  },
  { title: 'Draft Weight', key: 'weight', sortable: true, width: '35px' },
  { title: 'Draft Age', key: 'age', sortable: true, width: '35px' },
  { title: 'Years in the League', key: 'yearsOfService', sortable: true, width: '60px' },
  { title: 'Drafted From', key: 'preDraftTeam', sortable: true, minWidth: '175px' },
  { title: 'Pick Trades', key: 'draftTrades', sortable: false, minWidth: '80px', width: 'auto' }
]

const headers = computed(() => {
  if (props.showPlayerMeasurements) {
    return allHeaders
  }
  return allHeaders.filter(header => header.key !== 'height' && header.key !== 'weight' && header.key !== 'yearsOfService')
})

// Sort state - use prop value, fallback to local ref if not provided
const sortBy = computed({
  get: () => props.sortBy || [
    { key: 'year', order: 'desc' },
    { key: 'pick', order: 'asc' }
  ],
  set: (value) => emit('update:sortBy', value)
})

function handleSortUpdate(newSort: SortItem[]) {
  // Only allow single column sorting - if user tries to sort multiple columns,
  // just use the first one
  if (newSort.length > 0 && newSort[0]) {
    const firstSort = newSort[0]
    if (firstSort.order === 'asc' || firstSort.order === 'desc') {
      sortBy.value = [{ key: firstSort.key, order: firstSort.order }]
    }
  } else {
    // If all sorts cleared, restore default multi-sort
    sortBy.value = [
      { key: 'year', order: 'desc' },
      { key: 'pick', order: 'asc' }
    ]
  }
}

// Custom sort function that handles all column types
function sortItems(items: DraftPick[], sortBy: SortItem[]): DraftPick[] {
  if (!sortBy || sortBy.length === 0) {
    return items
  }

  return [...items].sort((a, b) => {
    for (const sort of sortBy) {
      const { key, order } = sort
      let aVal: string | number | null | undefined = a[key as keyof DraftPick] as string | number | null | undefined
      let bVal: string | number | null | undefined = b[key as keyof DraftPick] as string | number | null | undefined

      // Handle null/undefined values
      if (aVal == null && bVal == null) continue
      if (aVal == null) return order === 'asc' ? 1 : -1
      if (bVal == null) return order === 'asc' ? -1 : 1

      // Handle height (format: "6-8" or "6'8\"" etc.) - check this BEFORE string comparison
      // IMPORTANT: Always return early when sorting by height to prevent falling through to string comparison
      if (key === 'height') {
        const aHeight = parseHeight(aVal as string | null | undefined)
        const bHeight = parseHeight(bVal as string | null | undefined)
        // If both heights are 0 (invalid/empty), treat as equal
        if (aHeight === 0 && bHeight === 0) return 0
        // If one is 0 and the other isn't, put the 0 one at the end
        if (aHeight === 0) return order === 'asc' ? 1 : -1
        if (bHeight === 0) return order === 'asc' ? -1 : 1
        // Both are valid heights, compare numerically
        if (aHeight === bHeight) return 0
        const comparison = aHeight < bHeight ? -1 : 1
        return order === 'asc' ? comparison : -comparison
      }

      // Handle numeric comparisons
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal === bVal) continue
        const comparison = aVal < bVal ? -1 : 1
        return order === 'asc' ? comparison : -comparison
      }

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase().trim()
        bVal = bVal.toLowerCase().trim()
        if (aVal === bVal) continue
        const comparison = aVal < bVal ? -1 : 1
        return order === 'asc' ? comparison : -comparison
      }

      // Fallback: convert to string and compare
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr === bStr) continue
      const comparison = aStr < bStr ? -1 : 1
      return order === 'asc' ? comparison : -comparison
    }
    return 0
  })
}

// Helper function to parse height strings like "6-8" or "6'8\"" into inches
function parseHeight(height: string | null | undefined): number {
  if (!height) return 0
  const str = String(height).trim()
  if (str === '') return 0
  
  // Try format "6-8" (feet-inches) - this is the most common format
  // Match pattern: digits, then dash or apostrophe, then digits
  const match1 = str.match(/^(\d+)[-'](\d+)$/)
  if (match1 && match1[1] && match1[2]) {
    const feet = parseInt(match1[1], 10)
    const inches = parseInt(match1[2], 10)
    if (!isNaN(feet) && !isNaN(inches)) {
      return feet * 12 + inches
    }
  }
  
  // Try format "6'8\"" (feet'inches")
  const match2 = str.match(/^(\d+)'(\d+)"$/)
  if (match2 && match2[1] && match2[2]) {
    const feet = parseInt(match2[1], 10)
    const inches = parseInt(match2[2], 10)
    if (!isNaN(feet) && !isNaN(inches)) {
      return feet * 12 + inches
    }
  }
  
  // Try to parse as just a number (assume inches)
  const num = parseFloat(str)
  if (!isNaN(num) && num > 0) return num
  
  return 0
}

const items = computed(() => {
  return sortItems(props.data, sortBy.value)
})

// Paginated items for mobile view
const paginatedItems = computed(() => {
  if (itemsPerPage.value === -1) return items.value
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return items.value.slice(start, end)
})

// Check if any filters are active (non-default)
const hasActiveFilters = computed(() => {
  // Team filter active
  if (props.selectedTeam.length > 0) return true
  
  // Currently plays for filter active
  if (props.selectedPlaysFor.length > 0) return true
  
  // Year filter active
  if (!props.useYearRange && props.selectedYear !== null) return true
  if (props.useYearRange && (props.yearRange[0] !== 1947 || props.yearRange[1] !== 2025)) return true
  
  // Round filter active
  if (props.selectedRounds.length > 0) return true
  
  // Overall pick range active
  if (props.overallPickRange[0] !== 1 || props.overallPickRange[1] !== 61) return true
  
  // Pre-draft team filter active
  if (props.preDraftTeamSearch.length > 0) return true
  
  // Position filter active
  if (props.selectedPositions.length > 0) return true
  
  // Age range filter active
  if (props.ageRange[0] !== 17 || props.ageRange[1] !== 50) return true
  
  // Height range filter active
  if (props.heightRange && (props.heightRange[0] !== 60 || props.heightRange[1] !== 96)) return true
  
  // Weight range filter active
  if (props.weightRange && (props.weightRange[0] !== 140 || props.weightRange[1] !== 403)) return true
  
  // Years of service range filter active
  if (props.yearsOfServiceRange && (props.yearsOfServiceRange[0] !== 0 || props.yearsOfServiceRange[1] !== 30)) return true
  
  // Trade filter active
  if (props.tradeFilter !== 'all') return true
  
  // Retired filter active
  if (props.retiredFilter !== 'all') return true
  
  // Nationality filter active
  if (props.selectedNationalities && props.selectedNationalities.length > 0) return true
  
  // Player search active
  if (props.playerSearch && props.playerSearch.trim() !== '') return true
  
  return false
})

// Count active filters
function getActiveFiltersCount(): number {
  let count = 0
  if (props.selectedTeam.length > 0) count++
  if (props.selectedPlaysFor.length > 0) count++
  if (!props.useYearRange && props.selectedYear !== null) count++
  if (props.useYearRange && (props.yearRange[0] !== 1947 || props.yearRange[1] !== 2025)) count++
  if (props.selectedRounds.length > 0) count++
  if (props.overallPickRange[0] !== 1 || props.overallPickRange[1] !== 61) count++
  if (props.preDraftTeamSearch.length > 0) count++
  if (props.selectedPositions.length > 0) count++
  if (props.ageRange[0] !== 17 || props.ageRange[1] !== 50) count++
  if (props.heightRange && (props.heightRange[0] !== 60 || props.heightRange[1] !== 96)) count++
  if (props.weightRange && (props.weightRange[0] !== 140 || props.weightRange[1] !== 403)) count++
  if (props.tradeFilter !== 'all') count++
  if (props.retiredFilter !== 'all') count++
  if (props.selectedNationalities && props.selectedNationalities.length > 0) count++
  if (props.playerSearch && props.playerSearch.trim() !== '') count++
  return count
}

// Check if exactly one team is selected
const singleSelectedTeam = computed(() => {
  if (props.selectedTeam.length === 1) {
    return props.selectedTeam[0]
  }
  return null
})

// Get header logo and title
const headerLogo = computed(() => {
  if (singleSelectedTeam.value) {
    return getTeamLogoUrl(singleSelectedTeam.value)
  }
  return 'https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg'
})

const headerTitle = computed(() => {
  if (singleSelectedTeam.value) {
    return `Real ${getTeamFullName(singleSelectedTeam.value)} Draft History`
  }
  return 'Real NBA Draft History'
})

function handleScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
  showBackToTop.value = scrollTop > 300
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

onMounted(() => {
  loadTeams()
  // Set initial items per page based on mobile state
  if (isMobile.value && props.itemsPerPage === 30) {
    emit('update:itemsPerPage', 20)
  }
  // Inject page input between chevrons after table is rendered
  setTimeout(() => {
    injectPageInput()
  }, 100)
  // Add scroll listener for back-to-top button
  window.addEventListener('scroll', handleScroll)
  handleScroll() // Check initial scroll position
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

function injectPageInput() {
  const footer = document.querySelector('.v-data-table-footer')
  if (!footer) return

  const pagination = footer.querySelector('.v-data-table-footer__pagination')
  if (!pagination) return

  const pageArea = pagination.querySelector('.v-data-table-footer__page')
  if (!pageArea) return

  // Check if input already exists
  if (pageArea.querySelector('.page-input-wrapper')) return

  // Find the chevron buttons - try different selectors
  let leftChevron = pageArea.querySelector('.v-btn .mdi-chevron-left')?.closest('.v-btn')
  let rightChevron = pageArea.querySelector('.v-btn .mdi-chevron-right')?.closest('.v-btn')
  
  // Alternative: find by button order
  if (!leftChevron || !rightChevron) {
    const buttons = pageArea.querySelectorAll('.v-btn')
    if (buttons.length >= 2) {
      leftChevron = buttons[0] as HTMLElement
      rightChevron = buttons[buttons.length - 1] as HTMLElement
    }
  }
  
  if (!leftChevron || !rightChevron) return

  // Create the input wrapper
  const inputWrapper = document.createElement('div')
  inputWrapper.className = 'page-input-wrapper d-flex align-center gap-1'
  
  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'page-input-field'
  input.style.cssText = 'width: 60px; padding: 4px 8px; border: 1px solid rgba(0,0,0,0.12); border-radius: 4px; text-align: center;'
  input.min = '1'
  input.max = String(totalPages.value)
  input.placeholder = String(currentPage.value)
  
  const span = document.createElement('span')
  span.className = 'text-caption text-medium-emphasis'
  span.textContent = `/ ${totalPages.value}`
  
  inputWrapper.appendChild(input)
  inputWrapper.appendChild(span)

  // Insert between chevrons
  rightChevron.parentNode?.insertBefore(inputWrapper, rightChevron)

  // Add event listeners
  input.addEventListener('blur', handlePageInput)
  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePageInput(e)
    }
  })
  
  // Update placeholder when page changes
  watch(currentPage, () => {
    input.placeholder = String(currentPage.value)
    input.max = String(totalPages.value)
    span.textContent = `/ ${totalPages.value}`
  })
  
  watch(totalPages, () => {
    input.max = String(totalPages.value)
    span.textContent = `/ ${totalPages.value}`
  })
}

function getTeamLogoUrl(team: string, year?: number): string {
  // Use canonical team code for logo URL (aliases map to their canonical team's logo)
  const canonicalTeam = getCanonicalTeam(team, year)
  return `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${canonicalTeam.toLowerCase()}.svg`
}

function getPlayerHeadshotUrl(nbaId: string | number | undefined): string {
  if (!nbaId) return ''
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`
}

function getOriginalTeam(trades: string | null, year?: number): string | null {
  if (!trades || trades.trim() === '') return null

  // Parse trade chain format like "NOP to  ATL" or "CHA to  BOS BOS  to ATL"
  // Extract the first team (original drafter)
  const firstToIndex = trades.indexOf(' to ')
  if (firstToIndex === -1) return null

  const original = trades.substring(0, firstToIndex).trim()
  if (!original) return null

  // Return the display name (preserves alias if it's an alias)
  return getDisplayTeam(original, year)
}

/**
 * Gets the full team name for display, handling aliases correctly.
 * First gets the original team name (for aliases), then gets the full name.
 */
function getTeamDisplayName(team: string | null | undefined, year?: number): string {
  if (!team) return 'Unknown'
  // Get the original team name (handles aliases)
  const originalTeam = getOriginalTeamName(team, year)
  // Get the full name for that team
  return getTeamFullName(originalTeam)
}

function isDifferentTeam(originalTeam: string | null, currentTeam: string, year?: number): boolean {
  if (!originalTeam) return false
  return getCanonicalTeam(originalTeam, year) !== getCanonicalTeam(currentTeam, year)
}

function parseTradeChain(trades: string | null, year?: number): string[] {
  if (!trades || trades.trim() === '') return []

  // Parse trade chain format like "WAS to NYK NYK to OKC" or "CHA to  BOS BOS  to ATL"
  // Split by " to " (with possible extra spaces)
  const parts = trades.split(/\s+to\s+/).map(p => p.trim()).filter(p => p)
  
  if (parts.length < 2) return []

  // Extract teams: first part is the first team, then each subsequent part starts with the next team
  const displayTeams: string[] = []
  const canonicalTeams: string[] = []
  
  // Add the first team (everything before first " to ")
  const firstTeam = parts[0]?.trim()
  if (firstTeam) {
    displayTeams.push(getDisplayTeam(firstTeam, year))
    canonicalTeams.push(getCanonicalTeam(firstTeam, year))
  }

  // For each subsequent part, extract the team at the beginning
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    // Split by spaces and take the first word (the team abbreviation)
    const team = part.split(/\s+/)[0]
    if (team && team.length <= 4) { // Team abbreviations are typically 3-4 characters
      displayTeams.push(getDisplayTeam(team, year))
      canonicalTeams.push(getCanonicalTeam(team, year))
    }
  }

  // Remove duplicates while preserving order (unify chains) - use canonical for comparison
  const unifiedDisplayTeams: string[] = []
  const seenCanonical: string[] = []
  
  for (let i = 0; i < displayTeams.length; i++) {
    const displayTeam = displayTeams[i]
    const canonical = canonicalTeams[i]
    if (!displayTeam || !canonical) continue
    
    // Only add if we haven't seen this canonical team before (or it's the first)
    if (seenCanonical.length === 0 || seenCanonical[seenCanonical.length - 1] !== canonical) {
      unifiedDisplayTeams.push(displayTeam)
      seenCanonical.push(canonical)
    }
  }

  return unifiedDisplayTeams.length >= 2 ? unifiedDisplayTeams : []
}

function splitPosition(position: string): string[] {
  if (!position || position.trim() === '') return []
  // Remove "S" and "P" prefixes from position (e.g., "SG" -> "G", "PF" -> "F")
  position = position.replace(/^[SP]/g, '')
  // Split multi-position strings like "FC" into ["F", "C"], "GF" into ["G", "F"]
  return position.trim().split('').filter(char => char.match(/[A-Z]/))
}

function getPositionColor(position: string): string {
  switch (position) {
    case 'G':
      return 'primary'
    case 'F':
      return 'success'
    case 'C':
      return 'warning'
    default:
      return 'secondary'
  }
}

// Heatmap color function for age - younger players get green, older get blue
// Returns hex color optimized for tonal chips (better readability with lighter backgrounds)
function getAgeColor(age: number | null | undefined): string {
  if (!age || age <= 0) return '#9e9e9e' // Gray for missing/invalid age
  
  const min = minAge.value
  const max = maxAge.value
  const range = max - min
  
  if (range === 0) return '#4caf50' // Green if all ages are the same
  
  // Normalize age to 0-1 range (0 = youngest, 1 = oldest)
  const normalized = (age - min) / range
  
  // Heatmap: Green for young, Blue for old
  // Use HSL for better control and more vibrant colors for tonal chips
  // Hue: 120 (green) to 240 (blue)
  // Saturation: High (80-100%) for vibrant colors that work well with tonal variant
  // Lightness: Medium (40-50%) for good contrast on lighter backgrounds
  
  const hue = 120 + (240 - 120) * normalized // 120 (green) to 240 (blue)
  const saturation = 85 + (normalized * 10) // 85% to 95% - more saturated for better visibility
  const lightness = 45 - (normalized * 5) // 45% to 40% - slightly darker for contrast
  
  // Convert HSL to RGB
  const h = hue / 360
  const s = saturation / 100
  const l = lightness / 100
  
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h * 6) % 2 - 1))
  const m = l - c / 2
  
  let r = 0, g = 0, b = 0
  
  if (h < 1/6) {
    r = c; g = x; b = 0
  } else if (h < 2/6) {
    r = x; g = c; b = 0
  } else if (h < 3/6) {
    r = 0; g = c; b = x
  } else if (h < 4/6) {
    r = 0; g = x; b = c
  } else if (h < 5/6) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }
  
  // Convert to hex
  const red = Math.round((r + m) * 255)
  const green = Math.round((g + m) * 255)
  const blue = Math.round((b + m) * 255)
  
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`
}

// Heatmap color function for years of service - fewer years get yellow/orange, more years get red/purple
function getYearsOfServiceColor(years: number | null | undefined): string {
  if (years === undefined || years === null || years < 0) return '#9e9e9e' // Gray for missing/invalid
  
  const min = minYearsOfService.value
  const max = maxYearsOfService.value
  const range = max - min
  
  if (range === 0) return '#ff9800' // Orange if all years are the same
  
  // Normalize years to 0-1 range (0 = fewest years, 1 = most years)
  const normalized = (years - min) / range
  
  // Heatmap: Yellow/Orange for few years, Red/Purple for many years
  // Hue: 30 (yellow-orange) to 300 (magenta/purple)
  // Saturation: High (80-100%) for vibrant colors
  // Lightness: Medium (40-50%) for good contrast
  
  const hue = 30 + (300 - 30) * normalized // 30 (yellow-orange) to 300 (magenta)
  const saturation = 85 + (normalized * 10) // 85% to 95%
  const lightness = 45 - (normalized * 5) // 45% to 40%
  
  // Convert HSL to RGB
  const h = hue / 360
  const s = saturation / 100
  const l = lightness / 100
  
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h * 6) % 2 - 1))
  const m = l - c / 2
  
  let r = 0, g = 0, b = 0
  
  if (h < 1/6) {
    r = c; g = x; b = 0
  } else if (h < 2/6) {
    r = x; g = c; b = 0
  } else if (h < 3/6) {
    r = 0; g = c; b = x
  } else if (h < 4/6) {
    r = 0; g = x; b = c
  } else if (h < 5/6) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }
  
  // Convert to hex
  const red = Math.round((r + m) * 255)
  const green = Math.round((g + m) * 255)
  const blue = Math.round((b + m) * 255)
  
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`
}

// Computed properties for pagination
const totalPages = computed(() => {
  if (itemsPerPage.value === -1) return 1
  return Math.ceil(items.value.length / itemsPerPage.value)
})

const itemsPerPageOptions = computed(() => {
  if (isMobile.value) {
    return [
      { value: 20, title: '20' },
      { value: 30, title: '30' },
      { value: 50, title: '50' },
      { value: 100, title: '100' },
      { value: -1, title: 'All' }
    ]
  }
  return [
    { value: 30, title: '30' },
    { value: 60, title: '60' },
    { value: 100, title: '100' },
    { value: 250, title: '250' },
    { value: 500, title: '500' },
    { value: -1, title: 'All' }
  ]
})

const pageInput = ref('')
const selectedPlayer = ref<DraftPick | null>(null)
const showPlayerCard = ref(false)
const showBackToTop = ref(false)


function openPlayerCard(player: DraftPick) {
  selectedPlayer.value = player
  showPlayerCard.value = true
}

function handlePageInput(event?: Event) {
  let value: number
  if (event) {
    const target = event.target as HTMLInputElement
    value = parseInt(target.value, 10)
  } else {
    value = parseInt(String(pageInput.value), 10)
  }
  if (!isNaN(value) && value >= 1 && value <= totalPages.value) {
    currentPage.value = value
    pageInput.value = ''
  } else {
    pageInput.value = ''
  }
}

function getPlayerRetirementStatus(playedUntilYear: number | undefined): 'active' | 'retired' | 'unknown' {
  // If no retirement data, return unknown
  if (playedUntilYear === undefined) return 'unknown'
  const currentYear = new Date().getFullYear()
  return playedUntilYear < currentYear ? 'retired' : 'active'
}

function getRetirementTooltipText(playedUntilYear: number | undefined, playsFor: string | undefined, year?: number): string {
  const status = getPlayerRetirementStatus(playedUntilYear)
  if (status === 'active') {
    if (playsFor && playsFor.trim() !== '') {
      // Get the full team display name
      const teamFullName = getTeamDisplayName(playsFor, year)
      return `Currently plays for the ${teamFullName}`
    }
    return 'Currently active'
  } else if (status === 'retired') {
    if (playsFor && playsFor.trim() !== '') {
      // Get the full team display name
      const teamFullName = getTeamDisplayName(playsFor, year)
      return `Last played for the ${teamFullName} in ${playedUntilYear}`
    }
    return `Retired in ${playedUntilYear}`
  } else {
    return 'Unknown'
  }
}



// Watch for page changes to update the input placeholder
watch(currentPage, () => {
  // Clear input when page changes externally (via chevrons)
  if (pageInput.value) {
    pageInput.value = ''
  }
})

// Helper function to describe active filters
function getActiveFiltersDescription(): string {
  const filters: string[] = []
  
  if (props.selectedTeam.length > 0) {
    const teamNames = props.selectedTeam.map(t => getTeamFullName(t)).join(', ')
    filters.push(`Drafted by: ${teamNames}`)
  }
  
  if (props.selectedPlaysFor.length > 0) {
    const teamNames = props.selectedPlaysFor.map(t => getTeamFullName(t)).join(', ')
    filters.push(`Currently plays for: ${teamNames}`)
  }
  
  if (!props.useYearRange && props.selectedYear !== null) {
    filters.push(`Year: ${props.selectedYear}`)
  } else if (props.useYearRange && (props.yearRange[0] !== 1947 || props.yearRange[1] !== 2025)) {
    filters.push(`Year range: ${props.yearRange[0]}-${props.yearRange[1]}`)
  }
  
  if (props.selectedRounds.length > 0) {
    const rounds = props.selectedRounds.map(r => r === '3+' ? '3+' : `Round ${r}`).join(', ')
    filters.push(`Rounds: ${rounds}`)
  }
  
  if (props.overallPickRange[0] !== 1 || props.overallPickRange[1] !== 61) {
    filters.push(`Pick range: ${props.overallPickRange[0]}-${props.overallPickRange[1]}`)
  }
  
  if (props.preDraftTeamSearch.length > 0) {
    filters.push(`Drafted from: ${props.preDraftTeamSearch.slice(0, 2).join(', ')}${props.preDraftTeamSearch.length > 2 ? '...' : ''}`)
  }
  
  if (props.selectedPositions.length > 0) {
    filters.push(`Position: ${props.selectedPositions.join(', ')}`)
  }
  
  if (props.ageRange[0] !== 17 || props.ageRange[1] !== 50) {
    filters.push(`Age: ${props.ageRange[0]}-${props.ageRange[1]}`)
  }
  
  if (props.heightRange && (props.heightRange[0] !== 60 || props.heightRange[1] !== 96)) {
    filters.push(`Height: ${formatHeight(props.heightRange[0])}-${formatHeight(props.heightRange[1])}`)
  }
  
  if (props.weightRange && (props.weightRange[0] !== 140 || props.weightRange[1] !== 403)) {
    filters.push(`Weight: ${props.weightRange[0]}-${props.weightRange[1]} lbs`)
  }
  
  if (props.yearsOfServiceRange && (props.yearsOfServiceRange[0] !== 0 || props.yearsOfServiceRange[1] !== 30)) {
    filters.push(`Years in the League: ${props.yearsOfServiceRange[0]}-${props.yearsOfServiceRange[1]}`)
  }
  
  if (props.tradeFilter !== 'all') {
    filters.push(`Trade status: ${props.tradeFilter === 'traded' ? 'Traded only' : 'Not traded'}`)
  }
  
  if (props.retiredFilter !== 'all') {
    filters.push(`Retirement: ${props.retiredFilter === 'retired' ? 'Retired only' : 'Active only'}`)
  }
  
  if (props.selectedNationalities && props.selectedNationalities.length > 0) {
    const countries = props.selectedNationalities.map(c => getFormattedCountryName(c)).slice(0, 2).join(', ')
    filters.push(`Nationality: ${countries}${props.selectedNationalities.length > 2 ? '...' : ''}`)
  }
  
  if (props.playerSearch && props.playerSearch.trim() !== '') {
    filters.push(`Search: "${props.playerSearch}"`)
  }
  
  return filters.length > 0 ? filters.join('; ') : 'No filters applied'
}

// Get CSV column names dynamically
const csvColumns = computed(() => {
  const baseColumns = [
    'Year', 'Round', 'Pick', 'Player', 'Position', 
    'Height', 'Weight', 'Age', 'Pre-Draft Team', 'Class',
    'Draft Trades', 'Years of Service', 'Team', 'nba_id',
    'origin_country', 'played_until_year', 'is_defunct', 'plays_for'
  ]
  return baseColumns.join(', ')
})

// Tooltip text for export button
const exportTooltipText = computed(() => {
  const filterDesc = getActiveFiltersDescription()
  const rowCount = items.value.length
  const filtersText = filterDesc !== 'No filters applied' ? `\n\nActive filters: ${filterDesc}` : ''
  return `Export ${rowCount} ${rowCount === 1 ? 'pick' : 'picks'} to CSV with all current filters applied.${filtersText}\n\nColumns: ${csvColumns.value}`
})

// Tooltip text for share button
const shareTooltipText = computed(() => {
  const filterDesc = getActiveFiltersDescription()
  const filtersText = filterDesc !== 'No filters applied' ? `\n\nActive filters: ${filterDesc}` : ''
  return `Copy the current page URL to clipboard. The URL includes all active filters (including search), so anyone opening it will see the same filtered view.${filtersText}`
})
</script>

<template>
  <v-card elevation="2" class="draft-table">
    <v-card-title :class="['draft-table-header', 'sticky-table-header', isMobile ? 'd-flex flex-column align-start pa-3' : 'd-flex align-center justify-space-between pa-4']">
      <div :class="isMobile ? 'd-flex align-center justify-space-between w-100 mb-3' : 'd-flex align-center'">
        <div class="d-flex align-center flex-grow-1" :class="isMobile ? 'flex-column align-start' : ''">
          <div class="d-flex align-center">
            <v-avatar :size="isMobile ? 28 : 32" class="mr-2" rounded="0" style="background: transparent;">
              <v-img
                :src="headerLogo"
                :alt="singleSelectedTeam || 'NBA'"
                contain
              />
            </v-avatar>
            <span :class="isMobile ? 'text-h6' : ''">{{ headerTitle }}</span>
          </div>
          <v-chip 
            class="mt-1" 
            :class="isMobile ? 'ml-0' : 'ml-2'" 
            color="primary" 
            :size="isMobile ? 'x-small' : 'small'" 
            variant="flat"
          >
            {{ items.length }} picks
          </v-chip>
        </div>
      </div>
      <div :class="isMobile ? 'd-flex align-center justify-space-between w-100 gap-2' : 'd-flex align-center gap-2'">
        <!-- Player Search Bar -->
        <v-text-field
          v-model="playerSearch"
          placeholder="Search players..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="player-search-field"
          :class="isMobile ? 'flex-grow-1' : ''"
          :style="isMobile ? '' : 'max-width: 250px; min-width: 200px;'"
          rounded="xl"
        />
        
        <!-- Mobile: Single menu button with all actions -->
        <template v-if="isMobile">
          <v-menu v-model="actionsMenu" location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn
                v-bind="menuProps"
                icon="mdi-dots-vertical"
                variant="outlined"
                color="primary"
                size="default"
                title="Actions"
                min-width="44"
                min-height="44"
              />
            </template>
            <v-list>
              <v-tooltip location="right" :text="exportTooltipText" max-width="400">
                <template #activator="{ props: tooltipProps }">
                  <v-list-item
                    v-bind="tooltipProps"
                    prepend-icon="mdi-download"
                    title="Download CSV"
                    @click="() => { downloadCSV(); actionsMenu = false; }"
                  />
                </template>
              </v-tooltip>
              <v-tooltip location="right" :text="shareTooltipText" max-width="400">
                <template #activator="{ props: tooltipProps }">
                  <v-list-item
                    v-bind="tooltipProps"
                    prepend-icon="mdi-share-variant"
                    title="Share URL"
                    @click="() => { copyUrlToClipboard(); actionsMenu = false; }"
                  />
                </template>
              </v-tooltip>
              <v-list-item
                prepend-icon="mdi-filter-variant"
                title="Filters"
                @click="() => { filterMenu = true; actionsMenu = false; }"
              >
                <template #append>
                  <v-badge
                    :model-value="hasActiveFilters"
                    color="error"
                    dot
                    location="top end"
                  />
                </template>
              </v-list-item>
              <v-list-item
                v-if="props.resetFilters"
                prepend-icon="mdi-refresh"
                title="Reset Filters"
                :disabled="!hasActiveFilters"
                @click="() => { props.resetFilters?.(); actionsMenu = false; }"
              />
            </v-list>
          </v-menu>
        </template>

        <!-- Desktop: Three separate buttons -->
        <template v-else>
          <!-- Download CSV Button -->
          <v-tooltip location="bottom" :text="exportTooltipText" max-width="400">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon="mdi-download"
                variant="outlined"
                color="primary"
                size="small"
                @click="downloadCSV"
              />
            </template>
          </v-tooltip>
          
          <!-- Share Button -->
          <v-tooltip location="bottom" :text="shareTooltipText" max-width="400">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="tooltipProps"
                icon="mdi-share-variant"
                variant="outlined"
                color="primary"
                size="small"
                @click="copyUrlToClipboard"
              />
            </template>
          </v-tooltip>
          
          <!-- Desktop: Filter Menu with button as activator -->
          <v-menu 
            v-model="filterMenu" 
            location="bottom end" 
            :close-on-content-click="false"
          >
            <template #activator="{ props: menuProps }">
              <v-badge
                :model-value="hasActiveFilters"
                color="error"
                dot
                location="top end"
              >
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-filter-variant"
                  variant="outlined"
                  color="primary"
                  size="small"
                  title="Filters"
                />
              </v-badge>
            </template>
            <v-card class="filter-card pa-6">
              <v-card-title class="d-flex align-center justify-space-between mb-4">
                <div class="d-flex align-center">
                  <v-icon icon="mdi-filter-variant" class="mr-2" />
                  Filters
                </div>
                <v-btn
                  v-if="props.resetFilters"
                  icon="mdi-refresh"
                  variant="text"
                  color="primary"
                  size="small"
                  :disabled="!hasActiveFilters"
                  @click="props.resetFilters"
                  title="Reset all filters to default"
                />
              </v-card-title>
              <v-card-text class="pa-0">
                <!-- Quadrant 1: Team, Nationality, Drafted From -->
                <div class="pa-4 pb-2">
                  <v-row>
                    <v-col cols="12" md="6" class="mb-2">
                      <v-autocomplete
                        :model-value="props.selectedTeam"
                        @update:model-value="emit('update:selectedTeam', $event)"
                        :items="teamOptions"
                        :loading="loadingTeams"
                        label="Drafted By"
                        variant="outlined"
                        hide-details
                        multiple
                        chips
                        clearable
                        persistent-clear
                        closable-chips
                      >
                        <template #prepend-inner>
                          <div class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <img
                              src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
                              alt="NBA"
                              style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                            />
                          </div>
                        </template>
                        <template #item="{ props: itemProps, item }">
                          <v-list-item v-bind="itemProps">
                            <template #prepend v-if="item.raw.logo">
                              <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                <img 
                                  :src="item.raw.logo" 
                                  :alt="item.raw.title" 
                                  style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                                />
                              </div>
                            </template>
                          </v-list-item>
                        </template>

                        <template #selection="{ item }">
                          <v-chip
                            v-if="item.raw"
                            size="small"
                            class="mr-1"
                          >
                            <div v-if="item.raw.logo" class="team-logo-container mr-1" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                              <img 
                                :src="item.raw.logo" 
                                :alt="item.raw.title" 
                                style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                              />
                            </div>
                            <span>{{ item.raw.title }}</span>
                          </v-chip>
                        </template>
                      </v-autocomplete>
                    </v-col>

                    <!-- Currently Plays For Filter -->
                    <v-col cols="12" md="6" class="mb-2">
                      <v-autocomplete
                        :model-value="props.selectedPlaysFor"
                        @update:model-value="emit('update:selectedPlaysFor', $event)"
                        :items="teamOptions"
                        :loading="loadingTeams"
                        label="Currently Plays For"
                        variant="outlined"
                        hide-details
                        multiple
                        chips
                        clearable
                        persistent-clear
                        closable-chips
                      >
                        <template #prepend-inner>
                          <div class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <img
                              src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
                              alt="NBA"
                              style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                            />
                          </div>
                        </template>
                        <template #item="{ props: itemProps, item }">
                          <v-list-item v-bind="itemProps">
                            <template #prepend v-if="item.raw.logo">
                              <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                <img 
                                  :src="item.raw.logo" 
                                  :alt="item.raw.title" 
                                  style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                                />
                              </div>
                            </template>
                          </v-list-item>
                        </template>

                        <template #selection="{ item }">
                          <v-chip
                            v-if="item.raw"
                            size="small"
                            class="mr-1"
                          >
                            <div v-if="item.raw.logo" class="team-logo-container mr-1" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                              <img 
                                :src="item.raw.logo" 
                                :alt="item.raw.title" 
                                style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                              />
                            </div>
                            <span>{{ item.raw.title }}</span>
                          </v-chip>
                        </template>
                      </v-autocomplete>
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <v-autocomplete
                        :model-value="props.selectedNationalities"
                        @update:model-value="emit('update:selectedNationalities', $event)"
                        :items="nationalityOptions"
                        :loading="false"
                        label="Nationality"
                        variant="outlined"
                        hide-details
                        multiple
                        chips
                        clearable
                        persistent-clear
                        closable-chips
                      >
                        <template #prepend-inner>
                          <v-icon icon="mdi-flag" size="20" class="mr-2" />
                        </template>
                        <template #item="{ props: itemProps, item }">
                          <v-list-item v-bind="itemProps">
                            <template #prepend v-if="item.raw.flag">
                              <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                <span
                                  :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                                  style="font-size: 24px;"
                                />
                              </div>
                            </template>
                          </v-list-item>
                        </template>

                        <template #selection="{ item }">
                          <v-chip
                            v-if="item.raw"
                            size="small"
                            class="mr-1"
                          >
                            <span
                              v-if="item.raw.flag"
                              :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                              class="mr-1"
                              style="font-size: 16px; vertical-align: middle;"
                            />
                            <span>{{ item.raw.title }}</span>
                          </v-chip>
                        </template>
                      </v-autocomplete>
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <v-autocomplete
                        :model-value="props.preDraftTeamSearch"
                        @update:model-value="emit('update:preDraftTeamSearch', $event)"
                        :items="props.allPreDraftTeams"
                        label="Drafted From"
                        variant="outlined"
                        hide-details
                        multiple
                        chips
                        clearable
                        persistent-clear
                        prepend-inner-icon="mdi-school"
                        closable-chips
                      />
                    </v-col>
                  </v-row>
                </div>

                <v-divider></v-divider>

                <!-- Quadrant 2: Position, Round, Trade Status -->
                <div class="pa-4 pb-2">
                  <v-row>
                    <v-col cols="12" md="6" class="mb-2">
                      <v-select
                        :model-value="props.selectedPositions"
                        @update:model-value="emit('update:selectedPositions', $event)"
                        :items="positionOptions"
                        label="Position"
                        variant="outlined"
                        multiple
                        chips
                        clearable
                        persistent-clear
                        hide-details
                        prepend-inner-icon="mdi-account"
                        closable-chips
                      />
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <v-select
                        :model-value="props.selectedRounds"
                        @update:model-value="emit('update:selectedRounds', $event)"
                        :items="roundOptions"
                        label="Rounds"
                        variant="outlined"
                        multiple
                        chips
                        hide-details
                        prepend-inner-icon="mdi-numeric"
                      />
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <v-select
                        :model-value="props.tradeFilter"
                        @update:model-value="emit('update:tradeFilter', $event)"
                        :items="[
                          { value: 'all', title: 'All Picks' },
                          { value: 'traded', title: 'Traded Only' },
                          { value: 'not-traded', title: 'Not Traded' }
                        ]"
                        label="Trade Status"
                        variant="outlined"
                        hide-details
                        prepend-inner-icon="mdi-swap-horizontal"
                      />
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <v-select
                        :model-value="props.retiredFilter"
                        @update:model-value="emit('update:retiredFilter', $event)"
                        :items="[
                          { value: 'all', title: 'All Players' },
                          { value: 'retired', title: 'Retired Only' },
                          { value: 'not-retired', title: 'Active Only' }
                        ]"
                        label="Retirement Status"
                        variant="outlined"
                        hide-details
                        prepend-inner-icon="mdi-account-off"
                      />
                    </v-col>
                  </v-row>
                </div>

                <v-divider></v-divider>

                <!-- Quadrant 3: All Range Sliders -->
                <div class="pa-4 pb-2">
                  <v-row>
                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <div class="d-flex align-center justify-space-between mb-3">
                          <label class="text-caption text-medium-emphasis">Year</label>
                          <v-btn-toggle
                            :model-value="props.useYearRange ? 'range' : 'single'"
                            @update:model-value="emit('update:useYearRange', $event === 'range')"
                            variant="outlined"
                            mandatory
                          >
                            <v-btn value="single">Single</v-btn>
                            <v-btn value="range">Range</v-btn>
                          </v-btn-toggle>
                        </div>
                        <v-range-slider
                          v-if="props.useYearRange"
                          :model-value="props.yearRange"
                          @update:model-value="emit('update:yearRange', $event)"
                          :min="minYear"
                          :max="maxYear"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        />
                        <v-select
                          v-else
                          :model-value="props.selectedYear"
                          @update:model-value="emit('update:selectedYear', $event)"
                          :items="props.availableYears"
                          label="Select Year"
                          variant="outlined"
                          hide-details
                          clearable
                          persistent-clear
                          class="mt-2"
                        />
                      </div>
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <label class="text-caption text-medium-emphasis mb-3 d-block">
                          Overall Pick Range
                          <span v-if="props.overallPickRange && props.overallPickRange[1] === 61" class="ml-2 text-primary">
                            (61+)
                          </span>
                        </label>
                        <v-range-slider
                          :model-value="props.overallPickRange"
                          @update:model-value="emit('update:overallPickRange', $event)"
                          :min="1"
                          :max="61"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        />
                      </div>
                    </v-col>

                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <label class="text-caption text-medium-emphasis mb-3 d-block">Age Range</label>
                        <v-range-slider
                          :model-value="props.ageRange"
                          @update:model-value="emit('update:ageRange', $event)"
                          :min="minAge"
                          :max="maxAge"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        />
                      </div>
                    </v-col>
                  </v-row>
                </div>

                <v-divider></v-divider>

                <!-- Quadrant 4: Player Measurements -->
                <div class="pa-4">
                  <v-row>
                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <label class="text-caption text-medium-emphasis mb-3 d-block">
                          Height Range
                          <span class="ml-2 text-primary">
                            ({{ formatHeight(props.heightRange[0]) }} - {{ formatHeight(props.heightRange[1]) }})
                          </span>
                        </label>
                        <v-range-slider
                          :model-value="props.heightRange"
                          @update:model-value="emit('update:heightRange', $event)"
                          :min="props.minHeight || 60"
                          :max="props.maxHeight || 96"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        >
                          <template v-slot:thumb-label="{ modelValue }">
                            <span>{{ formatHeight(modelValue) }}</span>
                          </template>
                        </v-range-slider>
                      </div>
                    </v-col>
                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <label class="text-caption text-medium-emphasis mb-3 d-block">
                          Weight Range
                          <span class="ml-2 text-primary">
                            ({{ props.weightRange[0] }} - {{ props.weightRange[1] }} lbs)
                          </span>
                        </label>
                        <v-range-slider
                          :model-value="props.weightRange"
                          @update:model-value="emit('update:weightRange', $event)"
                          :min="props.minWeight || 140"
                          :max="props.maxWeight || 403"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        >
                          <template v-slot:thumb-label="{ modelValue }">
                            <span>{{ modelValue }} lbs</span>
                          </template>
                        </v-range-slider>
                      </div>
                    </v-col>
                    <v-col cols="12" md="6" class="mb-2">
                      <div class="px-1">
                        <label class="text-caption text-medium-emphasis mb-3 d-block">
                          Years in the League Range
                          <span class="ml-2 text-primary">
                            ({{ props.yearsOfServiceRange[0] }} - {{ props.yearsOfServiceRange[1] }} years)
                          </span>
                        </label>
                        <v-range-slider
                          :model-value="props.yearsOfServiceRange"
                          @update:model-value="emit('update:yearsOfServiceRange', $event)"
                          :min="props.minYearsOfService || 0"
                          :max="props.maxYearsOfService || 30"
                          :step="1"
                          thumb-label="always"
                          thumb-label-location="bottom"
                          hide-details
                          color="primary"
                          class="mt-2"
                        >
                          <template v-slot:thumb-label="{ modelValue }">
                            <span>{{ modelValue }} {{ modelValue === 1 ? 'year' : 'years' }}</span>
                          </template>
                        </v-range-slider>
                      </div>
                    </v-col>
                    <v-col cols="12" class="mb-2">
                      <v-checkbox
                        :model-value="props.showPlayerMeasurements"
                        @update:model-value="emit('update:showPlayerMeasurements', $event)"
                        label="Show Player Measurements"
                        hide-details
                      />
                    </v-col>
                  </v-row>
                </div>

                <v-divider v-if="props.availableAwards && props.availableAwards.length > 0"></v-divider>

                <!-- Awards Filter Section -->
                <div v-if="props.availableAwards && props.availableAwards.length > 0" class="pa-4 pb-2">
                  <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center justify-space-between">
                    <div class="d-flex align-center">
                      <v-icon icon="mdi-star" size="20" class="mr-2" />
                      Awards
                    </div>
                    <v-tooltip location="bottom" max-width="300">
                      <template v-slot:activator="{ props: tooltipProps }">
                        <v-btn-toggle
                          :model-value="props.awardFilterMode || 'exclusive'"
                          @update:model-value="emit('update:awardFilterMode', $event)"
                          variant="outlined"
                          mandatory
                          density="compact"
                          v-bind="tooltipProps"
                          class="award-mode-toggle"
                        >
                          <v-btn value="exclusive" size="small">All</v-btn>
                          <v-btn value="inclusive" size="small">Any</v-btn>
                        </v-btn-toggle>
                      </template>
                      <span>Exclusive (All): Shows players with ALL selected awards.<br>Inclusive (Any): Shows players with ANY selected award.</span>
                    </v-tooltip>
                  </div>
              <div class="awards-filter-list">
                <div
                  v-for="award in sortedAwards"
                  :key="award"
                  class="d-flex align-center mb-2"
                >
                  <v-checkbox
                    :model-value="award in (props.selectedAwards || {})"
                    @update:model-value="handleAwardCheckboxChange(award, $event)"
                    :label="formatAwardName(award)"
                    hide-details
                    density="comfortable"
                    class="flex-grow-1 mr-2"
                  />
                  <v-text-field
                    v-if="award in (props.selectedAwards || {}) && shouldShowAwardCount(award)"
                    :model-value="(props.selectedAwards || {})[award] || 1"
                    @update:model-value="handleAwardCountChange(award, Number($event))"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :min="1"
                    style="max-width: 80px;"
                    class="award-count-input"
                  />
                </div>
              </div>
                </div>
              </v-card-text>
            </v-card>
          </v-menu>
        </template>
        
        <!-- Mobile: Bottom Sheet for Filters -->
        <v-bottom-sheet v-model="filterMenu" v-if="isMobile" scrollable>
        <v-card class="filter-card">
          <v-card-title class="d-flex align-center justify-space-between pa-4 sticky-header">
            <div class="d-flex align-center">
              <v-icon icon="mdi-filter-variant" class="mr-2" />
              <span class="text-h6">Filters</span>
              <v-chip
                v-if="hasActiveFilters"
                class="ml-2"
                color="error"
                size="small"
                variant="flat"
              >
                {{ getActiveFiltersCount() }}
              </v-chip>
            </div>
            <div class="d-flex align-center gap-2">
              <v-btn
                v-if="props.resetFilters"
                icon="mdi-refresh"
                variant="text"
                color="primary"
                size="default"
                :disabled="!hasActiveFilters"
                @click="props.resetFilters"
                title="Reset all filters to default"
                min-width="44"
                min-height="44"
              />
              <v-btn
                icon="mdi-close"
                variant="text"
                @click="filterMenu = false"
                min-width="44"
                min-height="44"
              />
            </div>
          </v-card-title>
          <v-card-text class="pa-0 filter-content">
            <!-- Quadrant 1: Team, Nationality, Drafted From -->
            <div class="pa-4 pb-3">
              <v-row>
                <v-col cols="12" md="6" class="mb-3">
                  <v-autocomplete
                    :model-value="props.selectedTeam"
                    @update:model-value="emit('update:selectedTeam', $event)"
                    :items="teamOptions"
                    :loading="loadingTeams"
                    label="Team"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    clearable
                    persistent-clear
                    closable-chips
                  >
                    <template #prepend-inner>
                      <div class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <img
                          src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
                          alt="NBA"
                          style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                        />
                      </div>
                    </template>
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend v-if="item.raw.logo">
                          <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <img 
                              :src="item.raw.logo" 
                              :alt="item.raw.title" 
                              style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </template>

                    <template #selection="{ item }">
                      <v-chip
                        v-if="item.raw"
                        size="small"
                        class="mr-1"
                      >
                        <div v-if="item.raw.logo" class="team-logo-container mr-1" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                          <img 
                            :src="item.raw.logo" 
                            :alt="item.raw.title" 
                            style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                          />
                        </div>
                        <span>{{ item.raw.title }}</span>
                      </v-chip>
                    </template>
                  </v-autocomplete>
                </v-col>

                <!-- Currently Plays For Filter -->
                <v-col cols="12" md="6" class="mb-2">
                  <v-autocomplete
                    :model-value="props.selectedPlaysFor"
                    @update:model-value="emit('update:selectedPlaysFor', $event)"
                    :items="teamOptions"
                    :loading="loadingTeams"
                    label="Currently Plays For"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    clearable
                    persistent-clear
                    closable-chips
                  >
                    <template #prepend-inner>
                      <div class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <img
                          src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
                          alt="NBA"
                          style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                        />
                      </div>
                    </template>
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend v-if="item.raw.logo">
                          <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <img 
                              :src="item.raw.logo" 
                              :alt="item.raw.title" 
                              style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </template>

                    <template #selection="{ item }">
                      <v-chip
                        v-if="item.raw"
                        size="small"
                        class="mr-1"
                      >
                        <div v-if="item.raw.logo" class="team-logo-container mr-1" style="width: 20px; height: 20px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                          <img 
                            :src="item.raw.logo" 
                            :alt="item.raw.title" 
                            style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain;"
                          />
                        </div>
                        <span>{{ item.raw.title }}</span>
                      </v-chip>
                    </template>
                  </v-autocomplete>
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <v-select
                    :model-value="props.selectedNationalities"
                    @update:model-value="emit('update:selectedNationalities', $event)"
                    :items="nationalityOptions"
                    :loading="false"
                    label="Nationality"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    clearable
                    persistent-clear
                    closable-chips
                  >
                    <template #prepend-inner>
                      <div class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <span
                          :class="`fi fi-xx`"
                          style="font-size: 20px;"
                        />
                      </div>
                    </template>
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #prepend v-if="item.raw.flag">
                          <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            <span
                              :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                              style="font-size: 24px;"
                            />
                          </div>
                        </template>
                      </v-list-item>
                    </template>

                    <template #selection="{ item }">
                      <v-chip
                        v-if="item.raw"
                        size="small"
                        class="mr-1"
                      >
                        <span
                          v-if="item.raw.flag"
                          :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                          class="mr-1"
                          style="font-size: 16px; vertical-align: middle;"
                        />
                        <span>{{ item.raw.title }}</span>
                      </v-chip>
                    </template>
                  </v-select>
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <v-autocomplete
                    :model-value="props.preDraftTeamSearch"
                    @update:model-value="emit('update:preDraftTeamSearch', $event)"
                    :items="props.allPreDraftTeams"
                    label="Drafted From"
                    variant="outlined"
                    hide-details
                    multiple
                    chips
                    clearable
                    persistent-clear
                    prepend-inner-icon="mdi-school"
                    closable-chips
                  />
                </v-col>
              </v-row>
            </div>

            <!-- Quadrant 2: Position, Round, Trade Status -->
            <div class="pa-4 pb-3">
              <v-row>
                <v-col cols="12" md="6" class="mb-3">
                  <v-select
                    :model-value="props.selectedPositions"
                    @update:model-value="emit('update:selectedPositions', $event)"
                    :items="positionOptions"
                    label="Position"
                    variant="outlined"
                    multiple
                    chips
                    clearable
                    persistent-clear
                    hide-details
                    prepend-inner-icon="mdi-account"
                    closable-chips
                  />
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <v-select
                    :model-value="props.selectedRounds"
                    @update:model-value="emit('update:selectedRounds', $event)"
                    :items="roundOptions"
                    label="Rounds"
                    variant="outlined"
                    multiple
                    chips
                    hide-details
                    prepend-inner-icon="mdi-numeric"
                  />
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <v-select
                    :model-value="props.tradeFilter"
                    @update:model-value="emit('update:tradeFilter', $event)"
                    :items="[
                      { value: 'all', title: 'All Picks' },
                      { value: 'traded', title: 'Traded Only' },
                      { value: 'not-traded', title: 'Not Traded' }
                    ]"
                    label="Trade Status"
                    variant="outlined"
                    hide-details
                    prepend-inner-icon="mdi-swap-horizontal"
                  />
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <v-select
                    :model-value="props.retiredFilter"
                    @update:model-value="emit('update:retiredFilter', $event)"
                    :items="[
                      { value: 'all', title: 'All Players' },
                      { value: 'retired', title: 'Retired Only' },
                      { value: 'not-retired', title: 'Active Only' }
                    ]"
                    label="Retirement Status"
                    variant="outlined"
                    hide-details
                    prepend-inner-icon="mdi-account-off"
                  />
                </v-col>
              </v-row>
            </div>

            <v-divider class="my-2"></v-divider>

            <!-- Quadrant 3: All Range Sliders -->
            <div class="pa-4 pb-3">
              <v-row>
                <v-col cols="12" md="6" class="mb-3">
                  <div class="px-1">
                    <div class="d-flex align-center justify-space-between mb-3">
                      <label class="text-caption text-medium-emphasis">Year</label>
                      <v-btn-toggle
                        :model-value="props.useYearRange ? 'range' : 'single'"
                        @update:model-value="emit('update:useYearRange', $event === 'range')"
                        variant="outlined"
                        mandatory
                      >
                        <v-btn value="single">Single</v-btn>
                        <v-btn value="range">Range</v-btn>
                      </v-btn-toggle>
                    </div>
                    <v-range-slider
                      v-if="props.useYearRange"
                      :model-value="props.yearRange"
                      @update:model-value="emit('update:yearRange', $event)"
                      :min="minYear"
                      :max="maxYear"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    />
                    <v-select
                      v-else
                      :model-value="props.selectedYear"
                      @update:model-value="emit('update:selectedYear', $event)"
                      :items="props.availableYears"
                      label="Select Year"
                      variant="outlined"
                      hide-details
                      clearable
                      persistent-clear
                      class="mt-2"
                    />
                  </div>
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <div class="px-1">
                    <label class="text-caption text-medium-emphasis mb-3 d-block">
                      Overall Pick Range
                      <span v-if="props.overallPickRange && props.overallPickRange[1] === 61" class="ml-2 text-primary">
                        (61+)
                      </span>
                    </label>
                    <v-range-slider
                      :model-value="props.overallPickRange"
                      @update:model-value="emit('update:overallPickRange', $event)"
                      :min="1"
                      :max="61"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    />
                  </div>
                </v-col>

                <v-col cols="12" md="6" class="mb-2">
                  <div class="px-1">
                    <label class="text-caption text-medium-emphasis mb-3 d-block">Age Range</label>
                    <v-range-slider
                      :model-value="props.ageRange"
                      @update:model-value="emit('update:ageRange', $event)"
                      :min="minAge"
                      :max="maxAge"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    />
                  </div>
                </v-col>
              </v-row>
            </div>

            <v-divider class="my-2"></v-divider>

            <!-- Quadrant 4: Player Measurements -->
            <div class="pa-4 pb-4">
              <v-row>
                <v-col cols="12" md="6" class="mb-2">
                  <div class="px-1">
                    <label class="text-caption text-medium-emphasis mb-3 d-block">
                      Height Range
                      <span class="ml-2 text-primary">
                        ({{ formatHeight(props.heightRange[0]) }} - {{ formatHeight(props.heightRange[1]) }})
                      </span>
                    </label>
                    <v-range-slider
                      :model-value="props.heightRange"
                      @update:model-value="emit('update:heightRange', $event)"
                      :min="props.minHeight || 60"
                      :max="props.maxHeight || 96"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    >
                      <template v-slot:thumb-label="{ modelValue }">
                        <span>{{ formatHeight(modelValue) }}</span>
                      </template>
                    </v-range-slider>
                  </div>
                </v-col>
                <v-col cols="12" md="6" class="mb-2">
                  <div class="px-1">
                    <label class="text-caption text-medium-emphasis mb-3 d-block">
                      Weight Range
                      <span class="ml-2 text-primary">
                        ({{ props.weightRange[0] }} - {{ props.weightRange[1] }} lbs)
                      </span>
                    </label>
                    <v-range-slider
                      :model-value="props.weightRange"
                      @update:model-value="emit('update:weightRange', $event)"
                      :min="props.minWeight || 140"
                      :max="props.maxWeight || 403"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    >
                      <template v-slot:thumb-label="{ modelValue }">
                        <span>{{ modelValue }} lbs</span>
                      </template>
                    </v-range-slider>
                  </div>
                </v-col>
                <v-col cols="12" md="6" class="mb-2">
                  <div class="px-1">
                    <label class="text-caption text-medium-emphasis mb-3 d-block">
                      Years in the League Range
                      <span class="ml-2 text-primary">
                        ({{ props.yearsOfServiceRange[0] }} - {{ props.yearsOfServiceRange[1] }} years)
                      </span>
                    </label>
                    <v-range-slider
                      :model-value="props.yearsOfServiceRange"
                      @update:model-value="emit('update:yearsOfServiceRange', $event)"
                      :min="props.minYearsOfService || 0"
                      :max="props.maxYearsOfService || 30"
                      :step="1"
                      thumb-label="always"
                      thumb-label-location="bottom"
                      hide-details
                      color="primary"
                      class="mt-2"
                    >
                      <template v-slot:thumb-label="{ modelValue }">
                        <span>{{ modelValue }} {{ modelValue === 1 ? 'year' : 'years' }}</span>
                      </template>
                    </v-range-slider>
                  </div>
                </v-col>
                <v-col cols="12" class="mb-2">
                  <v-checkbox
                    :model-value="props.showPlayerMeasurements"
                    @update:model-value="emit('update:showPlayerMeasurements', $event)"
                    label="Show Player Measurements"
                    hide-details
                    density="comfortable"
                    class="touch-target-checkbox"
                  />
                </v-col>
              </v-row>
            </div>

            <v-divider v-if="props.availableAwards && props.availableAwards.length > 0" class="my-2"></v-divider>

            <!-- Awards Filter Section -->
            <div v-if="props.availableAwards && props.availableAwards.length > 0" class="pa-4 pb-3">
              <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center justify-space-between">
                <div class="d-flex align-center">
                  <v-icon icon="mdi-star" size="20" class="mr-2" />
                  Awards
                </div>
                <v-tooltip location="bottom" max-width="300">
                  <template v-slot:activator="{ props: tooltipProps }">
                    <v-btn-toggle
                      :model-value="props.awardFilterMode || 'exclusive'"
                      @update:model-value="emit('update:awardFilterMode', $event)"
                      variant="outlined"
                      mandatory
                      density="comfortable"
                      v-bind="tooltipProps"
                      class="award-mode-toggle"
                    >
                      <v-btn value="exclusive">All</v-btn>
                      <v-btn value="inclusive">Any</v-btn>
                    </v-btn-toggle>
                  </template>
                  <span>Exclusive (All): Shows players with ALL selected awards.<br>Inclusive (Any): Shows players with ANY selected award.</span>
                </v-tooltip>
              </div>
              <div class="awards-filter-list">
                <div
                  v-for="award in sortedAwards"
                  :key="award"
                  class="d-flex align-center mb-2"
                >
                  <v-checkbox
                    :model-value="award in (props.selectedAwards || {})"
                    @update:model-value="handleAwardCheckboxChange(award, $event)"
                    :label="formatAwardName(award)"
                    hide-details
                    density="comfortable"
                    class="flex-grow-1 mr-2"
                  />
                  <v-text-field
                    v-if="award in (props.selectedAwards || {}) && shouldShowAwardCount(award)"
                    :model-value="(props.selectedAwards || {})[award] || 1"
                    @update:model-value="handleAwardCountChange(award, Number($event))"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :min="1"
                    style="max-width: 80px;"
                    class="award-count-input"
                  />
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-bottom-sheet>
      </div>
    </v-card-title>

    <!-- Share Notification Snackbar -->
    <v-snackbar
      v-model="shareSnackbar"
      :timeout="3000"
      color="success"
      location="top"
      rounded="xl"
      timer="white"
      elevation="2"
    >
      <p class="text-center">{{ shareSnackbarText }}</p>
    </v-snackbar>

    <!-- Mobile Card View -->
    <div v-if="isMobile" class="mobile-cards-container">
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="primary"
        class="mb-4"
      />
      
      <div v-if="!loading && paginatedItems.length === 0" class="text-center pa-8">
        <v-icon icon="mdi-information-outline" size="48" color="info" class="mb-2" />
        <p class="text-h6">No draft picks found</p>
        <p class="text-body-2 text-medium-emphasis">Try adjusting your filters</p>
      </div>

      <template v-else>
        <MobileDraftCard
          v-for="item in paginatedItems"
          :key="`${item.year}-${item.pick}-${item.player}`"
          :item="item"
          :show-player-measurements="props.showPlayerMeasurements"
          @player-click="openPlayerCard"
        />
      </template>

      <!-- Mobile Pagination -->
      <div v-if="!loading && items.length > 0" class="mobile-pagination mt-4">
        <v-row align="center" justify="center" class="mb-2">
          <v-col cols="12" class="d-flex align-center justify-center flex-wrap gap-2">
            <v-btn
              icon="mdi-chevron-left"
              variant="outlined"
              :disabled="currentPage === 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
              size="large"
              min-width="44"
              min-height="44"
            />
            
            <div class="d-flex align-center gap-2">
              <input
                v-model.number="pageInput"
                type="number"
                :min="1"
                :max="totalPages"
                class="page-input-mobile"
                @keydown.enter="handlePageInput($event)"
                @blur="handlePageInput($event)"
              />
              <span class="text-body-2 text-medium-emphasis">/ {{ totalPages }}</span>
            </div>
            
            <v-btn
              icon="mdi-chevron-right"
              variant="outlined"
              :disabled="currentPage >= totalPages"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
              size="large"
              min-width="44"
              min-height="44"
            />
          </v-col>
        </v-row>
        
        <v-row align="center" justify="center">
          <v-col cols="12" class="d-flex align-center justify-center">
            <span class="text-body-2 text-medium-emphasis mr-2">Items per page:</span>
            <v-select
              v-model="itemsPerPage"
              :items="itemsPerPageOptions"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 120px;"
            />
          </v-col>
        </v-row>
      </div>
    </div>

    <!-- Desktop Table View -->
    <v-data-table
      v-else
      :headers="headers"
      :items="items"
      :loading="loading"
      v-model:page="currentPage"
      v-model:items-per-page="itemsPerPage"
      :items-per-page-options="itemsPerPageOptions"
      :sort-by="sortBy"
      @update:sort-by="handleSortUpdate"
      items-per-page-text="Picks per page:"
      :density="isMobile ? 'compact' : 'comfortable'"
      hover
      fixed-header
      :height="isMobile ? '500' : 'calc(100vh - 250px)'"
    >
      <template #item.team="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="32" class="mr-2" rounded="0" style="background: transparent;">
            <v-img
              :src="getTeamLogoUrl(item.team, item.year)"
              :alt="getOriginalTeamName(item.team, item.year)"
              contain
            />
          </v-avatar>
          <div class="d-flex flex-column">
            <span class="font-weight-medium">{{ getOriginalTeamName(item.team, item.year) }}</span>
            <span
              v-if="isDifferentTeam(getOriginalTeam(item.draftTrades, item.year), item.team, item.year)"
              class="text-caption text-medium-emphasis"
            >
              (via {{ getOriginalTeam(item.draftTrades, item.year) }})
            </span>
          </div>
        </div>
      </template>

      <template #item.player="{ item }">
        <div class="d-flex align-center player-cell">
          <v-avatar 
            :size="isMobile ? 32 : 40" 
            class="mr-3 player-headshot"
            :class="{ 'player-headshot-clickable': item.nba_id }"
            color="grey-lighten-4"
            @click.stop="item.nba_id ? openPlayerCard(item) : undefined"
          >
            <v-img
              v-if="item.nba_id"
              :src="getPlayerHeadshotUrl(item.nba_id)"
              :alt="item.player"
              cover
              eager
              class="player-headshot-img"
            >
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-icon icon="mdi-account" size="24" color="grey-lighten-1" />
                </div>
              </template>
              <template #error>
                <div class="d-flex align-center justify-center fill-height">
                  <v-icon icon="mdi-account" size="24" color="grey-lighten-1" />
                </div>
              </template>
            </v-img>
            <v-img
              v-else
              :src="getPlayerHeadshotUrl(202382)"
              :alt="item.player"
              cover
              eager
              class="player-headshot-img"
            >
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-icon icon="mdi-account" size="24" color="grey-lighten-1" />
                </div>
              </template>
              <template #error>
                <div class="d-flex align-center justify-center fill-height">
                  <v-icon icon="mdi-account" size="24" color="grey-lighten-1" />
                </div>
              </template>
            </v-img>
          </v-avatar>
          <div class="d-flex align-center flex-wrap gap-1">
            <span class="font-weight-bold text-primary">
              {{ item.player }}
              <!-- Deceased Indicator -->
              <v-icon
                v-if="item.is_defunct === 1"
                icon="mdi-cross"
                title="Deceased"
                size="16"
                color="error"
                class="player-deceased-icon"
              />
            </span>
            <!-- Nationality Flag - always show, fallback to 'un' -->
            <v-tooltip location="top">
              <template #activator="{ props: tooltipProps }">
                <span
                  v-bind="tooltipProps"
                  :class="`fi fi-${getCountryCode(item.origin_country)}`"
                  class="player-flag-icon"
                />
              </template>
              <span>{{ getFormattedCountryName(item.origin_country) }}</span>
            </v-tooltip>
            <!-- Retired/Active Indicator - show team logo if active and plays for different team, otherwise show status icon -->
            <v-tooltip location="top">
              <template #activator="{ props: tooltipProps }">
                <template v-if="getPlayerRetirementStatus(item.played_until_year) === 'active' && item.plays_for && getCanonicalTeam(item.plays_for, item.year) !== getCanonicalTeam(item.team, item.year)">
                  <v-avatar
                    v-bind="tooltipProps"
                    size="16"
                    rounded="0"
                    style="background: transparent;"
                    class="player-status-icon"
                  >
                    <v-img
                      :src="getTeamLogoUrl(item.plays_for, item.year)"
                      :alt="item.plays_for"
                      contain
                    />
                  </v-avatar>
                </template>
                <v-icon
                  v-else
                  v-bind="tooltipProps"
                  :icon="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'mdi-account-off' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'mdi-account-check' : 'mdi-account-question'"
                  size="16"
                  :color="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'grey' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'success' : 'warning'"
                  class="player-status-icon"
                />
              </template>
              <span v-if="getPlayerRetirementStatus(item.played_until_year) === 'active' && item.plays_for">
                Currently plays for the {{ getTeamDisplayName(item.plays_for, item.year) }}
              </span>
              <span v-else>{{ getRetirementTooltipText(item.played_until_year, item.plays_for, item.year) }}</span>
            </v-tooltip>
            <!-- Awards Star Icon -->
            <v-tooltip v-if="item.awards && Object.keys(item.awards).length > 0" location="top">
              <template #activator="{ props: tooltipProps }">
                <v-icon
                  v-bind="tooltipProps"
                  icon="mdi-star"
                  size="16"
                  color="warning"
                  class="player-awards-icon"
                />
              </template>
              <div>
                <ul style="margin: 0; padding-left: 20px; text-align: left;">
                  <li v-for="(times, awardName) in item.awards" :key="awardName">
                    {{ formatAwardName(awardName) }} ({{ times }} {{ times === 1 ? 'time' : 'times' }})
                  </li>
                </ul>
              </div>
            </v-tooltip>
          </div>
        </div>
      </template>

      <template #item.position="{ item }">
        <div class="d-flex gap-1">
          <v-chip
            v-for="(pos, index) in splitPosition(item.position)"
            :key="index"
            size="small"
            variant="tonal"
            :color="getPositionColor(pos)"
          >
            {{ pos }}
          </v-chip>
          <span v-if="!item.position || item.position.trim() === ''">-</span>
        </div>
      </template>

      <template #item.height="{ item }">
        <span class="text-body-2">{{ item.height || '-' }}</span>
      </template>

      <template #item.weight="{ item }">
        <span class="text-body-2">{{ item.weight ? `${item.weight} lbs` : '-' }}</span>
      </template>

      <template #item.age="{ item }">
        <v-chip 
          size="small" 
          variant="tonal"
          :color="getAgeColor(item.age) || 'white'"
        >
          {{ item.age || '-' }}
        </v-chip>
      </template>

      <template #item.yearsOfService="{ item }">
        <v-chip 
          size="small" 
          variant="tonal"
          :color="getYearsOfServiceColor(item.yearsOfService) || 'white'"
        >
          {{ item.yearsOfService !== undefined ? item.yearsOfService : '-' }}
        </v-chip>
      </template>

      <template #item.preDraftTeam="{ item }">
        <span class="text-medium-emphasis pre-draft-team-text">{{ item.preDraftTeam || '-' }}</span>
      </template>

      <template #item.draftTrades="{ item }">
        <template v-if="item.draftTrades">
          <div class="trade-chain">
            <template v-for="(team, index) in parseTradeChain(item.draftTrades, item.year)" :key="index">
              <v-avatar size="24" class="mr-1" rounded="0" style="background: transparent;">
                <v-img
                  :src="getTeamLogoUrl(team, item.year)"
                  :alt="getTeamDisplayName(team, item.year)"
                  contain
                />
              </v-avatar>
              <span v-if="index < parseTradeChain(item.draftTrades, item.year).length - 1" class="mx-1 text-medium-emphasis">→</span>
            </template>
          </div>
        </template>
        <span v-else class="text-medium-emphasis">-</span>
      </template>

      <template #loading>
        <v-skeleton-loader type="table-row@10" />
      </template>

      <template #no-data>
        <div class="text-center pa-4">
          <v-icon icon="mdi-information-outline" size="48" color="info" class="mb-2" />
          <p class="text-h6">No draft picks found</p>
          <p class="text-body-2 text-medium-emphasis">Try adjusting your filters</p>
        </div>
      </template>

    </v-data-table>

    <!-- Player Card Dialog -->
    <PlayerCard
      v-model="showPlayerCard"
      :player="selectedPlayer"
    />

    <!-- Back to Top Button -->
    <v-fade-transition>
      <v-btn
        v-show="showBackToTop"
        class="back-to-top-btn"
        icon="mdi-chevron-up"
        color="primary"
        size="large"
        elevation="4"
        @click="scrollToTop"
      />
    </v-fade-transition>
  </v-card>
</template>

<style scoped lang="scss">
.draft-table {
  .sticky-table-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: rgba(var(--v-theme-surface), 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  :deep(.v-data-table) {
    font-size: 0.875rem;
  }

  :deep(.v-data-table-header) {
    background-color: rgba(var(--v-theme-primary), 0.05);
  }

  :deep(.v-data-table__th) {
    font-weight: 600;
    white-space: nowrap;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.5px;
    padding: 24px 20px !important;
  }

  @media (max-width: 959px) {
    :deep(.v-data-table__th) {
      padding: 12px 8px !important;
      font-size: 0.7rem;
    }
  }

  // Hide sort priority numbers (for initial multi-sort)
  :deep(.v-data-table-header__sort-badge),
  :deep(.v-data-table__sort-badge) {
    display: none !important;
  }

  :deep(.v-data-table__td) {
    white-space: nowrap;
    padding: 16px 28px !important;
  }

  @media (max-width: 959px) {
    :deep(.v-data-table__td) {
      padding: 8px 4px !important;
    }
  }

  :deep(.v-data-table__tr:hover) {
    background-color: rgba(var(--v-theme-primary), 0.03);
  }

  .trade-chain {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 2px;
    min-width: fit-content;
  }
  
  // Prevent wrapping in the Pick Trades column (last column)
  :deep(.v-data-table__tr .v-data-table__td:last-child) {
    white-space: nowrap !important;
    overflow: visible !important;
    min-width: fit-content;
  }
  
  // Ensure trade-chain itself doesn't wrap
  :deep(.trade-chain) {
    white-space: nowrap !important;
  }
  
  // Ensure the table can expand horizontally
  :deep(.v-data-table) {
    overflow-x: auto;
    width: 100%;
  }
  
  // Make sure the table wrapper doesn't constrain width
  :deep(.v-data-table__wrapper) {
    overflow-x: auto;
    min-width: 100%;
  }
  
  // Allow the card to expand horizontally if needed
  &.draft-table {
    overflow-x: auto;
  }

  // Global avatar styling for team logos (not player headshots)
  :deep(.v-avatar:not(.player-headshot) img),
  :deep(.v-avatar:not(.player-headshot) .v-img__img),
  :deep(.v-avatar:not(.player-headshot) .v-img) {
    object-fit: contain !important;
    background: transparent !important;
    width: 100% !important;
    height: 100% !important;
  }
  
  :deep(.v-avatar:not(.player-headshot)) {
    background: transparent !important;
    overflow: visible !important;
  }
  
  // Fix logo clipping in dropdown - ensure avatars don't get cropped
  :deep(.v-list-item__prepend) {
    width: auto !important;
    min-width: auto !important;
    overflow: visible !important;
  }
  
  // Team logo containers in select dropdowns
  .team-logo-container {
    overflow: visible !important;
    background: transparent !important;
    
    img {
      object-fit: contain !important;
      display: block;
    }
  }
  
  // Ensure logo containers in select items don't get clipped
  :deep(.v-select .v-list-item__prepend .team-logo-container),
  :deep(.v-autocomplete .v-list-item__prepend .team-logo-container) {
    overflow: visible !important;
  }
  
  // Prevent select containers from expanding when chips are added
  :deep(.v-select),
  :deep(.v-autocomplete) {
    width: 100%;
    max-width: 100%;
  }
  
  :deep(.v-select__selection),
  :deep(.v-autocomplete__selection) {
    overflow-x: auto;
    overflow-y: hidden;
    flex-wrap: nowrap;
    max-width: 100%;
    min-width: 0;
    white-space: nowrap;
  }
  
  // Ensure chips don't cause expansion
  :deep(.v-select__selection .v-chip),
  :deep(.v-autocomplete__selection .v-chip) {
    flex-shrink: 0;
  }
  
  // Responsive filter menu card
  .filter-card {
    width: 100%;
    max-width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    
    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(var(--v-theme-surface), 1);
      border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    }

    .filter-content {
      max-height: calc(80vh - 80px);
      overflow-y: auto;
      padding-bottom: 24px;
    }
  }

  @media (min-width: 960px) {
    .filter-card {
      width: 650px;
      min-width: 650px;
      max-width: 650px;
      max-height: none;
      overflow-y: visible;
      
      .sticky-header {
        position: relative;
        border-bottom: none;
      }

      .filter-content {
        max-height: none;
        overflow-y: visible;
      }
    }
  }

  :deep(.v-menu__content) {
    max-width: 100% !important;
  }

  @media (min-width: 960px) {
    :deep(.v-menu__content) {
      width: 650px !important;
      min-width: 650px !important;
      max-width: 650px !important;
    }
  }

  .pre-draft-team-text {
    word-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    max-width: 20ch;
    display: inline-block;
  }

  // Player headshot styling
  .player-cell {
    min-height: 48px;
  }

  .player-headshot {
    flex-shrink: 0;
    border: 2px solid rgba(var(--v-theme-surface), 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    overflow: hidden !important;
    border-radius: 50% !important;

    &.player-headshot-clickable {
      cursor: pointer;

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }
    }

    :deep(.player-headshot-img),
    :deep(.v-img) {
      width: 100% !important;
      height: 100% !important;
      border-radius: 50% !important;
      overflow: hidden !important;
    }

    :deep(.v-img__img) {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center top;
      border-radius: 50% !important;
    }

    :deep(.v-img__wrapper) {
      width: 100% !important;
      height: 100% !important;
      border-radius: 50% !important;
      overflow: hidden !important;
    }

    :deep(.v-img__sizer) {
      padding-bottom: 0 !important;
    }

    :deep(.v-avatar__underlay) {
      background: transparent;
      border-radius: 50% !important;
    }
  }

  // Ensure player column has enough width for headshot
  :deep(.v-data-table__td:nth-child(2)) {
    min-width: 200px;
  }

  // Player flag and status icons
  .player-flag-icon {
    display: inline-block;
    width: 16px;
    height: 12px;
    border-radius: 2px;
    vertical-align: middle;
    margin-left: 4px;
    flex-shrink: 0;
  }

  .player-status-icon {
    margin-left: 4px;
    flex-shrink: 0;
  }

  // Allow Pre-Draft Team column to wrap
  :deep(.v-data-table__td:nth-child(10)) {
    white-space: normal !important;
  }

  // Style for injected page input
  .page-input-wrapper {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0 8px;
  }

  .page-input-field {
    text-align: center;
  }

  // Mobile touch target improvements
  @media (max-width: 959px) {
    .player-cell {
      min-height: 40px;
    }

    .player-headshot {
      margin-right: 8px !important;
    }

    // Ensure buttons meet minimum 44x44px touch target
    :deep(.v-btn) {
      min-width: 44px;
      min-height: 44px;
    }

    // Improve spacing between filter controls
    .filter-card {
      .v-col {
        margin-bottom: 16px !important;
      }
    }

    // Larger touch targets for sliders
    :deep(.v-slider-thumb) {
      width: 20px !important;
      height: 20px !important;
    }

    // Better spacing for toggle buttons
    :deep(.v-btn-toggle .v-btn) {
      min-height: 44px;
      padding: 8px 16px;
    }

    // Improve chip spacing in selects
    :deep(.v-select__selection .v-chip),
    :deep(.v-autocomplete__selection .v-chip) {
      margin: 2px 4px 2px 0;
    }

    // Optimize pagination controls for mobile
    :deep(.v-data-table-footer) {
      flex-wrap: wrap;
      padding: 8px 4px !important;
    }

    :deep(.v-data-table-footer__pagination) {
      margin: 8px 0;
    }

    :deep(.v-data-table-footer__items-per-page) {
      margin: 8px 0;
    }

    // Ensure pagination buttons are touch-friendly
    :deep(.v-data-table-footer .v-btn) {
      min-width: 44px;
      min-height: 44px;
    }

    // Make page input touch-friendly
    .page-input-field {
      min-height: 44px;
      font-size: 16px; // Prevents zoom on iOS
    }

    // Mobile cards container
    .mobile-cards-container {
      padding: 8px 0;
    }

    // Mobile pagination
    .mobile-pagination {
      padding: 16px;
      background: rgba(var(--v-theme-surface), 0.5);
      border-radius: 8px;
    }

    .page-input-mobile {
      width: 60px;
      padding: 8px 12px;
      border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
      border-radius: 4px;
      text-align: center;
      font-size: 16px; // Prevents zoom on iOS
      min-height: 44px;
      background: rgba(var(--v-theme-surface), 1);
      color: rgba(var(--v-theme-on-surface), 1);
    }

    // Ensure checkboxes have proper touch targets
    .touch-target-checkbox {
      :deep(.v-selection-control) {
        min-height: 44px;
      }
    }

    // Ensure list items have proper touch targets
    :deep(.v-list-item) {
      min-height: 44px;
    }
  }

  // Tooltip styling for better readability
  :deep(.v-tooltip > .v-overlay__content) {
    max-width: 400px;
    white-space: pre-line;
    word-wrap: break-word;
    line-height: 1.5;
  }

  // Back to Top Button
  .back-to-top-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
    }

    @media (max-width: 959px) {
      bottom: 16px;
      right: 16px;
      min-width: 56px;
      min-height: 56px;
    }
  }
}
</style>
