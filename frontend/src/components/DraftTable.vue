<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useDisplay } from 'vuetify'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getCanonicalTeam, getDisplayTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { getDataUrl } from '@/utils/dataUrl'
import { exportDraftPicksToCSV, downloadCSV as downloadCSVFile } from '@/utils/csvExporter'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { useCountryData } from '@/composables/useCountryData'
import PlayerCard from './PlayerCard.vue'

const display = useDisplay()
const isMobile = computed(() => display.mobile.value)
const { getFormattedCountryName } = useCountryData()

type SortItem = { key: string; order: 'asc' | 'desc' }

interface DraftTableProps {
  data: DraftPick[]
  loading?: boolean
  selectedTeam?: TeamAbbreviation[]
  yearRange?: [number, number]
  selectedYear?: number | null
  useYearRange?: boolean
  selectedRounds?: (number | string)[]
  overallPickRange?: [number, number]
  preDraftTeamSearch?: string[]
  selectedPositions?: string[]
  ageRange?: [number, number]
  tradeFilter?: 'all' | 'traded' | 'not-traded'
  selectedNationalities?: string[]
  sortBy?: SortItem[]
  currentPage?: number
  itemsPerPage?: number
  availableYears?: number[]
  allPreDraftTeams?: string[]
  availableAges?: number[]
  availableNationalities?: string[]
  showPlayerMeasurements?: boolean
}

const props = withDefaults(defineProps<DraftTableProps>(), {
  loading: false,
  selectedTeam: () => [],
  yearRange: () => [1947, 2025],
  selectedYear: null,
  useYearRange: () => true,
  selectedRounds: () => [],
  overallPickRange: () => [1, 61],
  preDraftTeamSearch: () => [],
  selectedPositions: () => [],
  ageRange: () => [17, 50],
  tradeFilter: () => 'all',
  selectedNationalities: () => [],
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
  showPlayerMeasurements: false
})

const emit = defineEmits<{
  'update:selectedTeam': [value: TeamAbbreviation[]]
  'update:yearRange': [value: [number, number]]
  'update:selectedYear': [value: number | null]
  'update:useYearRange': [value: boolean]
  'update:selectedRounds': [value: (number | string)[]]
  'update:overallPickRange': [value: [number, number]]
  'update:preDraftTeamSearch': [value: string[]]
  'update:selectedPositions': [value: string[]]
  'update:ageRange': [value: [number, number]]
  'update:tradeFilter': [value: 'all' | 'traded' | 'not-traded']
  'update:selectedNationalities': [value: string[]]
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

const minYear = computed(() => props.availableYears.length > 0 ? Math.min(...props.availableYears) : 1947)
const maxYear = computed(() => props.availableYears.length > 0 ? Math.max(...props.availableYears) : 2025)

async function loadTeams() {
  try {
    const response = await fetch(getDataUrl('teams.json'))
    const data = await response.json() as TeamAbbreviation[]
    teams.value = data

    teamOptions.value = data.map((abbr) => ({
      value: abbr,
      title: abbr,
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
  { title: 'Height', key: 'height', sortable: true, width: '35px' },
  { title: 'Weight', key: 'weight', sortable: true, width: '35px' },
  { title: 'Draft Age', key: 'age', sortable: true, width: '35px' },
  { title: 'Drafted From', key: 'preDraftTeam', sortable: true, minWidth: '175px' },
  { title: 'Pick Trades', key: 'draftTrades', sortable: false, minWidth: '80px', width: 'auto' }
]

const headers = computed(() => {
  if (props.showPlayerMeasurements) {
    return allHeaders
  }
  return allHeaders.filter(header => header.key !== 'height' && header.key !== 'weight')
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

      // Handle string comparisons (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase().trim()
        bVal = bVal.toLowerCase().trim()
        if (aVal === bVal) continue
        const comparison = aVal < bVal ? -1 : 1
        return order === 'asc' ? comparison : -comparison
      }

      // Handle numeric comparisons
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal === bVal) continue
        const comparison = aVal < bVal ? -1 : 1
        return order === 'asc' ? comparison : -comparison
      }

      // Handle height (format: "6-8" or "6'8\"" etc.)
      if (key === 'height') {
        const aHeight = parseHeight(aVal as string | null | undefined)
        const bHeight = parseHeight(bVal as string | null | undefined)
        if (aHeight === bHeight) continue
        const comparison = aHeight < bHeight ? -1 : 1
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

const items = computed(() => {
  return sortItems(props.data, sortBy.value)
})

// Check if any filters are active (non-default)
const hasActiveFilters = computed(() => {
  // Team filter active
  if (props.selectedTeam.length > 0) return true
  
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
  
  // Trade filter active
  if (props.tradeFilter !== 'all') return true
  
  // Nationality filter active
  if (props.selectedNationalities && props.selectedNationalities.length > 0) return true
  
  return false
})

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
    return `${singleSelectedTeam.value} Draft History`
  }
  return 'NBA Draft History'
})

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


function openPlayerCard(player: DraftPick) {
  selectedPlayer.value = player
  showPlayerCard.value = true
}

function handlePageInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value, 10)
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

function getRetirementTooltipText(playedUntilYear: number | undefined): string {
  const status = getPlayerRetirementStatus(playedUntilYear)
  if (status === 'active') {
    return 'Active'
  } else if (status === 'retired') {
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
</script>

<template>
  <v-card elevation="2" class="draft-table">
    <v-card-title class="d-flex align-center justify-space-between pa-4">
      <div class="d-flex align-center">
        <v-avatar size="32" class="mr-2" rounded="0" style="background: transparent;">
          <v-img
            :src="headerLogo"
            :alt="singleSelectedTeam || 'NBA'"
            contain
          />
        </v-avatar>
        {{ headerTitle }}
        <v-chip class="ml-2" color="primary" size="small" variant="flat">
          {{ items.length }} picks
        </v-chip>
      </div>
      <div class="d-flex align-center gap-2">
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
              />
            </template>
            <v-list>
              <v-list-item
                prepend-icon="mdi-download"
                title="Download CSV"
                @click="() => { downloadCSV(); actionsMenu = false; }"
              />
              <v-list-item
                prepend-icon="mdi-share-variant"
                title="Share URL"
                @click="() => { copyUrlToClipboard(); actionsMenu = false; }"
              />
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
            </v-list>
          </v-menu>
        </template>

        <!-- Desktop: Three separate buttons -->
        <template v-else>
          <!-- Download CSV Button -->
          <v-btn
            icon="mdi-download"
            variant="outlined"
            color="primary"
            size="small"
            @click="downloadCSV"
            title="Download CSV"
          />
          
          <!-- Share Button -->
          <v-btn
            icon="mdi-share-variant"
            variant="outlined"
            color="primary"
            size="small"
            @click="copyUrlToClipboard"
            title="Share URL"
          />
          
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
              <v-card-title class="d-flex align-center mb-4">
                <v-icon icon="mdi-filter-variant" class="mr-2" />
                Filters
              </v-card-title>
              <v-card-text class="pa-0">
                <v-row>
                  <!-- Team Filter -->
                  <v-col cols="12" md="6" class="mb-2">
                    <v-select
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
                    </v-select>
                  </v-col>

                  <!-- Year Filter -->
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
                        class="mt-2"
                      />
                    </div>
                  </v-col>

                  <!-- Round Filter -->
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

                  <!-- Overall Pick Range -->
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

                  <!-- Pre-Draft Team Search -->
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
                      prepend-inner-icon="mdi-school"
                      closable-chips
                    />
                  </v-col>

                  <!-- Position Filter -->
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
                      hide-details
                      prepend-inner-icon="mdi-account"
                      closable-chips
                    />
                  </v-col>

                  <!-- Age Range Filter -->
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

                  <!-- Trade Filter -->
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

                  <!-- Nationality Filter -->
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
                    </v-select>
                  </v-col>

                  <!-- Player Measurements Toggle -->
                  <v-col cols="12" md="6" class="mb-2">
                    <v-checkbox
                      :model-value="props.showPlayerMeasurements"
                      @update:model-value="emit('update:showPlayerMeasurements', $event)"
                      label="Show Player Measurements"
                      hide-details
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-menu>
        </template>
        
        <!-- Mobile: Bottom Sheet for Filters -->
        <v-bottom-sheet v-model="filterMenu" v-if="isMobile">
        <v-card class="filter-card">
          <v-card-title class="d-flex align-center justify-space-between pa-4">
            <div class="d-flex align-center">
              <v-icon icon="mdi-filter-variant" class="mr-2" />
              Filters
            </div>
            <v-btn
              icon="mdi-close"
              variant="text"
              @click="filterMenu = false"
            />
          </v-card-title>
          <v-card-text class="pa-4">
            <v-row>
              <!-- Team Filter -->
              <v-col cols="12" md="6" class="mb-2">
                <v-select
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
                </v-select>
              </v-col>

              <!-- Year Filter -->
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
                    class="mt-2"
                  />
                </div>
              </v-col>

              <!-- Round Filter -->
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

              <!-- Overall Pick Range -->
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

              <!-- Pre-Draft Team Search -->
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
                  prepend-inner-icon="mdi-school"
                  closable-chips
                />
              </v-col>

              <!-- Position Filter -->
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
                  hide-details
                  prepend-inner-icon="mdi-account"
                  closable-chips
                />
              </v-col>

              <!-- Age Range Filter -->
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

              <!-- Trade Filter -->
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

              <!-- Nationality Filter -->
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

              <!-- Player Measurements Toggle -->
              <v-col cols="12" class="mb-2">
                <v-checkbox
                  :model-value="props.showPlayerMeasurements"
                  @update:model-value="emit('update:showPlayerMeasurements', $event)"
                  label="Show Player Measurements"
                  hide-details
                  density="comfortable"
                />
              </v-col>
            </v-row>
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

    <v-data-table
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
            <!-- Retired/Active Indicator - always show -->
            <v-tooltip location="top">
              <template #activator="{ props: tooltipProps }">
                <v-icon
                  v-bind="tooltipProps"
                  :icon="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'mdi-account-off' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'mdi-account-check' : 'mdi-account-question'"
                  size="16"
                  :color="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'grey' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'success' : 'warning'"
                  class="player-status-icon"
                />
              </template>
              <span>{{ getRetirementTooltipText(item.played_until_year) }}</span>
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
                  :alt="team"
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
  </v-card>
</template>

<style scoped lang="scss">
.draft-table {
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

  :deep(.v-avatar img),
  :deep(.v-avatar .v-img__img),
  :deep(.v-avatar .v-img) {
    object-fit: contain !important;
    background: transparent !important;
    width: 100% !important;
    height: 100% !important;
  }
  
  :deep(.v-avatar) {
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
  }

  @media (min-width: 960px) {
    .filter-card {
      width: 650px;
      min-width: 650px;
      max-width: 650px;
      max-height: none;
      overflow-y: visible;
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
  }
}
</style>
