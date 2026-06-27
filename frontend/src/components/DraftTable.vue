<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getCanonicalTeam, getDisplayTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { exportDraftPicksToCSV, downloadCSV as downloadCSVFile } from '@/utils/csvExporter'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { NON_US_DRAFT_COUNTRY, US_DRAFT_COUNTRY } from '@/utils/draftCountry'
import { useCountryData } from '@/composables/useCountryData'
import { useTeamData } from '@/composables/useTeamData'
import { parseHeight } from '@/utils/parseHeight'
import { formatHeight } from '@/utils/formatHeight'
import { getCurrentSeasonStartYear } from '@/utils/season'
import {
  YEAR_MIN, YEAR_MAX,
  PICK_MIN, PICK_MAX,
  AGE_MIN, AGE_MAX,
  HEIGHT_MIN, HEIGHT_MAX,
  WEIGHT_MIN, WEIGHT_MAX,
  YOS_MIN, YOS_MAX,
  DEFAULT_ITEMS_PER_PAGE
} from '@/constants/filters'
import PlayerCard from './PlayerCard.vue'
import MobileDraftCard from './MobileDraftCard.vue'
import FilterPanel from './FilterPanel.vue'
import DraftColumnHeader from './DraftColumnHeader.vue'
import draggable from 'vuedraggable'
import { useColumnPreferences } from '@/composables/useColumnPreferences'

const display = useDisplay()
const isMobile = computed(() => display.mobile.value)
const { getFormattedCountryName } = useCountryData()
const { loadTeamData, getTeamFullName, getAllTeamAbbreviations } = useTeamData()

type SortItem = { key: string; order: 'asc' | 'desc' }

interface DraftTableProps {
  data: DraftPick[]
  loading?: boolean
  selectedTeam?: TeamAbbreviation[]
  selectedOnceOwnedBy?: TeamAbbreviation[]
  selectedPlaysFor?: TeamAbbreviation[]
  yearRange?: [number, number]
  selectedYear?: number | null
  useYearRange?: boolean
  selectedRounds?: (number | string)[]
  overallPickRange?: [number, number]
  preDraftTeamSearch?: string[]
  selectedDraftCountries?: string[]
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
  availableDraftCountries?: string[]
  availableAges?: number[]
  availableNationalities?: string[]
  availableAwards?: string[]
  minHeight?: number
  maxHeight?: number
  minWeight?: number
  maxWeight?: number
  minYearsOfService?: number
  maxYearsOfService?: number
  resetFilters?: () => void
}

const props = withDefaults(defineProps<DraftTableProps>(), {
  loading: false,
  selectedTeam: () => [],
  selectedOnceOwnedBy: () => [],
  selectedPlaysFor: () => [],
  yearRange: () => [YEAR_MIN, YEAR_MAX],
  selectedYear: null,
  useYearRange: () => true,
  selectedRounds: () => [],
  overallPickRange: () => [PICK_MIN, PICK_MAX],
  preDraftTeamSearch: () => [],
  selectedDraftCountries: () => [],
  selectedPositions: () => [],
  ageRange: () => [AGE_MIN, AGE_MAX],
  heightRange: () => [HEIGHT_MIN, HEIGHT_MAX],
  weightRange: () => [WEIGHT_MIN, WEIGHT_MAX],
  yearsOfServiceRange: () => [YOS_MIN, YOS_MAX],
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
  itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
  availableYears: () => [],
  allPreDraftTeams: () => [],
  availableDraftCountries: () => [],
  availableAges: () => [],
  availableNationalities: () => [],
  availableAwards: () => [],
  minHeight: HEIGHT_MIN,
  maxHeight: HEIGHT_MAX,
  minWeight: WEIGHT_MIN,
  maxWeight: WEIGHT_MAX,
  minYearsOfService: YOS_MIN,
  maxYearsOfService: YOS_MAX,
})

const emit = defineEmits<{
  'update:selectedTeam': [value: TeamAbbreviation[]]
  'update:selectedOnceOwnedBy': [value: TeamAbbreviation[]]
  'update:selectedPlaysFor': [value: TeamAbbreviation[]]
  'update:yearRange': [value: [number, number]]
  'update:selectedYear': [value: number | null]
  'update:useYearRange': [value: boolean]
  'update:selectedRounds': [value: (number | string)[]]
  'update:overallPickRange': [value: [number, number]]
  'update:preDraftTeamSearch': [value: string[]]
  'update:selectedDraftCountries': [value: string[]]
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

interface NationalityOption {
  value: string
  title: string
  flag?: string
}

// Format award names for display (keeping NBA prefix)
function formatAwardName(award: string): string {
  return award
}

const nationalityOptions = computed<NationalityOption[]>(() => {
  return props.availableNationalities.map((cca2) => ({
    value: cca2,
    title: getFormattedCountryName(cca2),
    flag: cca2
  })).sort((a, b) => a.title.localeCompare(b.title))
})

interface DraftCountryOption {
  value: string
  title: string
  flag?: string
}

const draftCountryOptions = computed<DraftCountryOption[]>(() => {
  const countries = props.availableDraftCountries
    .map((code) => ({ value: code, title: getFormattedCountryName(code), flag: code }))
    .sort((a, b) => a.title.localeCompare(b.title))
  // The "all non-US countries" umbrella is only meaningful when foreign origins exist.
  const hasForeign = props.availableDraftCountries.some((code) => code !== US_DRAFT_COUNTRY)
  if (!hasForeign) {
    return countries
  }
  return [{ value: NON_US_DRAFT_COUNTRY, title: 'All non-US countries' }, ...countries]
})

const minAge = computed(() => props.availableAges.length > 0 ? Math.min(...props.availableAges) : 17)
const maxAge = computed(() => props.availableAges.length > 0 ? Math.max(...props.availableAges) : 50)

const minYearsOfService = computed(() => props.minYearsOfService || 0)
const maxYearsOfService = computed(() => props.maxYearsOfService || 30)

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

// Single source of wiring shared by both FilterPanel instances (desktop menu + mobile
// sheet): read-only option data plus every two-way filter field and its update handler.
const filterBind = computed(() => ({
  teamOptions: teamOptions.value,
  nationalityOptions: nationalityOptions.value,
  draftCountryOptions: draftCountryOptions.value,
  loadingTeams: loadingTeams.value,
  allPreDraftTeams: props.allPreDraftTeams,
  availableYears: props.availableYears,
  availableAges: props.availableAges,
  availableAwards: props.availableAwards,
  minHeight: props.minHeight,
  maxHeight: props.maxHeight,
  minWeight: props.minWeight,
  maxWeight: props.maxWeight,
  minYearsOfService: props.minYearsOfService,
  maxYearsOfService: props.maxYearsOfService,
  selectedTeam: props.selectedTeam,
  'onUpdate:selectedTeam': (v: TeamAbbreviation[]) => emit('update:selectedTeam', v),
  selectedOnceOwnedBy: props.selectedOnceOwnedBy,
  'onUpdate:selectedOnceOwnedBy': (v: TeamAbbreviation[]) => emit('update:selectedOnceOwnedBy', v),
  selectedPlaysFor: props.selectedPlaysFor,
  'onUpdate:selectedPlaysFor': (v: TeamAbbreviation[]) => emit('update:selectedPlaysFor', v),
  selectedNationalities: props.selectedNationalities,
  'onUpdate:selectedNationalities': (v: string[]) => emit('update:selectedNationalities', v),
  preDraftTeamSearch: props.preDraftTeamSearch,
  'onUpdate:preDraftTeamSearch': (v: string[]) => emit('update:preDraftTeamSearch', v),
  selectedDraftCountries: props.selectedDraftCountries,
  'onUpdate:selectedDraftCountries': (v: string[]) => emit('update:selectedDraftCountries', v),
  selectedPositions: props.selectedPositions,
  'onUpdate:selectedPositions': (v: string[]) => emit('update:selectedPositions', v),
  selectedRounds: props.selectedRounds,
  'onUpdate:selectedRounds': (v: (number | string)[]) => emit('update:selectedRounds', v),
  tradeFilter: props.tradeFilter,
  'onUpdate:tradeFilter': (v: 'all' | 'traded' | 'not-traded') => emit('update:tradeFilter', v),
  retiredFilter: props.retiredFilter,
  'onUpdate:retiredFilter': (v: 'all' | 'retired' | 'not-retired') => emit('update:retiredFilter', v),
  useYearRange: props.useYearRange,
  'onUpdate:useYearRange': (v: boolean) => emit('update:useYearRange', v),
  yearRange: props.yearRange,
  'onUpdate:yearRange': (v: [number, number]) => emit('update:yearRange', v),
  selectedYear: props.selectedYear,
  'onUpdate:selectedYear': (v: number | null) => emit('update:selectedYear', v),
  overallPickRange: props.overallPickRange,
  'onUpdate:overallPickRange': (v: [number, number]) => emit('update:overallPickRange', v),
  ageRange: props.ageRange,
  'onUpdate:ageRange': (v: [number, number]) => emit('update:ageRange', v),
  heightRange: props.heightRange,
  'onUpdate:heightRange': (v: [number, number]) => emit('update:heightRange', v),
  weightRange: props.weightRange,
  'onUpdate:weightRange': (v: [number, number]) => emit('update:weightRange', v),
  yearsOfServiceRange: props.yearsOfServiceRange,
  'onUpdate:yearsOfServiceRange': (v: [number, number]) => emit('update:yearsOfServiceRange', v),
  selectedAwards: props.selectedAwards,
  'onUpdate:selectedAwards': (v: Record<string, number>) => emit('update:selectedAwards', v),
  awardFilterMode: props.awardFilterMode,
  'onUpdate:awardFilterMode': (v: 'exclusive' | 'inclusive') => emit('update:awardFilterMode', v),
}))


// Custom numeric sort for the height column (stored as "6-8" style strings).
function heightSort(a: DraftPick, b: DraftPick): number {
  const aHeight = parseHeight(a.height)
  const bHeight = parseHeight(b.height)
  if (aHeight === 0 && bHeight === 0) return 0
  if (aHeight === 0) return 1
  if (bHeight === 0) return -1
  return aHeight - bHeight
}

// The three measurement columns stay governed by the existing "Show Player
// Measurements" toggle; every other column is individually hideable via the
// columns menu. Order and width are user-customizable for all of them.
const MEASUREMENT_KEYS = ['height', 'weight', 'yearsOfService']

interface ColumnMeta {
  key: string
  title: string
  sortable: boolean
  defaultWidth: number
  sort?: (a: DraftPick, b: DraftPick) => number
}

const COLUMN_META: ColumnMeta[] = [
  { key: 'team', title: 'Team', sortable: true, defaultWidth: 150 },
  { key: 'player', title: 'Player', sortable: true, defaultWidth: 250 },
  { key: 'year', title: 'Year', sortable: true, defaultWidth: 100 },
  { key: 'round', title: 'Round', sortable: true, defaultWidth: 110 },
  { key: 'pick', title: 'Overall Pick', sortable: true, defaultWidth: 150 },
  { key: 'position', title: 'Position', sortable: true, defaultWidth: 130 },
  { key: 'height', title: 'Draft Height', sortable: true, defaultWidth: 140, sort: heightSort },
  { key: 'weight', title: 'Draft Weight', sortable: true, defaultWidth: 140 },
  { key: 'age', title: 'Draft Age', sortable: true, defaultWidth: 130 },
  { key: 'yearsOfService', title: 'Years in the League', sortable: true, defaultWidth: 190 },
  { key: 'preDraftTeam', title: 'Drafted From', sortable: true, defaultWidth: 200 },
  { key: 'draftTrades', title: 'Pick Trades', sortable: false, defaultWidth: 220 },
]

const COLUMN_META_BY_KEY = new Map(COLUMN_META.map((c) => [c.key, c]))
const DEFAULT_COLUMN_ORDER = COLUMN_META.map((c) => c.key)
const DEFAULT_COLUMN_WIDTHS = Object.fromEntries(COLUMN_META.map((c) => [c.key, c.defaultWidth]))
// Every column is individually hideable via the columns menu; the measurement
// columns simply start hidden (matching the prior default-off behavior).
const TOGGLEABLE_COLUMN_KEYS = COLUMN_META.map((c) => c.key)

const {
  order: columnOrder,
  visibility: columnVisibility,
  widths: columnWidths,
  hasCustomWidths,
  setWidth: setColumnWidth,
  setVisibility: setColumnVisibility,
  resetWidths,
  reset: resetColumns,
} = useColumnPreferences({
  storageKey: 'ndh:column-prefs:v2',
  defaultOrder: DEFAULT_COLUMN_ORDER,
  defaultWidths: DEFAULT_COLUMN_WIDTHS,
  toggleableKeys: TOGGLEABLE_COLUMN_KEYS,
  defaultHidden: MEASUREMENT_KEYS,
})

function isColumnVisible(key: string): boolean {
  return columnVisibility.value[key] !== false
}

// Mobile cards have no column controls; their compact measurement summary follows
// whether any measurement column is enabled in the (persisted) column preferences.
const showMeasurementsOnMobile = computed(() =>
  MEASUREMENT_KEYS.some((key) => isColumnVisible(key)),
)

const headers = computed(() => {
  return columnOrder.value
    .filter((key) => isColumnVisible(key))
    .map((key) => {
      const meta = COLUMN_META_BY_KEY.get(key)!
      return {
        title: meta.title,
        key: meta.key,
        sortable: meta.sortable,
        width: `${columnWidths.value[key] ?? meta.defaultWidth}px`,
        ...(meta.sort ? { sort: meta.sort } : {}),
      }
    })
})

// Total width of all visible columns; drives the fixed-layout table's min-width so
// resized columns keep their exact pixel sizes (overflowing into horizontal scroll).
const tableContentWidth = computed(() =>
  columnOrder.value
    .filter((key) => isColumnVisible(key))
    .reduce((sum, key) => sum + (columnWidths.value[key] ?? COLUMN_META_BY_KEY.get(key)!.defaultWidth), 0),
)

// Draggable model for the columns menu reorder list (mirrors columnOrder).
const columnMenu = ref(false)
const orderedColumnList = computed<ColumnMeta[]>({
  get: () => columnOrder.value.map((key) => COLUMN_META_BY_KEY.get(key)!),
  set: (list) => {
    columnOrder.value = list.map((c) => c.key)
  },
})

// Column width drag-resize, wired through the header grip.
let resizingKey: string | null = null
let resizeStartX = 0
let resizeStartWidth = 0

function onResizeMove(event: PointerEvent) {
  if (!resizingKey) return
  setColumnWidth(resizingKey, resizeStartWidth + (event.clientX - resizeStartX))
}

// The header cell sorts on click. After a resize drag (or a plain press on the grip)
// the browser still fires a click on the cell, which would toggle the sort. Swallow
// that one trailing click in the capture phase before it reaches the sort handler.
function suppressNextClick(event: Event) {
  event.stopPropagation()
  window.removeEventListener('click', suppressNextClick, true)
}

function onResizeEnd() {
  resizingKey = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  document.body.style.userSelect = ''
  window.addEventListener('click', suppressNextClick, true)
  // If no click follows (e.g. pointer released off-target), drop the suppressor.
  setTimeout(() => window.removeEventListener('click', suppressNextClick, true), 0)
}

function startColumnResize(key: string, event: PointerEvent) {
  resizingKey = key
  resizeStartX = event.clientX
  resizeStartWidth = columnWidths.value[key] ?? COLUMN_META_BY_KEY.get(key)?.defaultWidth ?? 120
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeEnd)
  document.body.style.userSelect = 'none'
}

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

const items = computed(() => {
  return sortItems(props.data, sortBy.value)
})

// Scoreboard-style tween so the pick count animates when the result set changes.
const displayCount = ref(0)
let countRaf = 0

watch(
  () => items.value.length,
  (target) => {
    cancelAnimationFrame(countRaf)
    const start = displayCount.value
    const startTime = performance.now()
    const duration = 480
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      displayCount.value = Math.round(start + (target - start) * eased)
      if (progress < 1) countRaf = requestAnimationFrame(tick)
    }
    countRaf = requestAnimationFrame(tick)
  },
  { immediate: true }
)

// Replays the table's staggered entrance whenever the filtered result set changes.
const tableAnimKey = ref(0)
watch(
  () => props.data,
  () => {
    tableAnimKey.value++
  }
)

// Mobile cards render just-in-time: an initial batch is shown and the next batch is
// appended as a bottom sentinel scrolls into view, mirroring the desktop virtual
// table's on-demand row loading instead of paginating.
const MOBILE_BATCH_SIZE = 20
const mobileLoadedCount = ref(MOBILE_BATCH_SIZE)
const loadMoreSentinel = ref<HTMLElement | null>(null)
let mobileLoadObserver: IntersectionObserver | null = null

const mobileVisibleItems = computed(() => items.value.slice(0, mobileLoadedCount.value))
const hasMoreMobileItems = computed(() => mobileLoadedCount.value < items.value.length)

function loadMoreMobileItems() {
  if (!hasMoreMobileItems.value) return
  mobileLoadedCount.value = Math.min(mobileLoadedCount.value + MOBILE_BATCH_SIZE, items.value.length)
}

// Reset to the first batch whenever the filtered/sorted result set changes.
watch(items, () => {
  mobileLoadedCount.value = MOBILE_BATCH_SIZE
})

// Keep the observer pointed at the live sentinel node as it mounts and unmounts.
watch(loadMoreSentinel, (el, prev) => {
  if (prev) mobileLoadObserver?.unobserve(prev)
  if (el) mobileLoadObserver?.observe(el)
})

// Check if any filters are active (non-default)
const hasActiveFilters = computed(() => {
  // Team filter active
  if (props.selectedTeam.length > 0) return true

  // Once owned by filter active
  if (props.selectedOnceOwnedBy.length > 0) return true

  // Currently plays for filter active
  if (props.selectedPlaysFor.length > 0) return true

  // Year filter active
  if (!props.useYearRange && props.selectedYear !== null) return true
  if (props.useYearRange && (props.yearRange[0] !== YEAR_MIN || props.yearRange[1] !== YEAR_MAX)) return true

  // Round filter active
  if (props.selectedRounds.length > 0) return true

  // Overall pick range active
  if (props.overallPickRange[0] !== PICK_MIN || props.overallPickRange[1] !== PICK_MAX) return true

  // Pre-draft team filter active
  if (props.preDraftTeamSearch.length > 0) return true

  // Drafted-from country filter active
  if (props.selectedDraftCountries.length > 0) return true

  // Position filter active
  if (props.selectedPositions.length > 0) return true

  // Age range filter active
  if (props.ageRange[0] !== AGE_MIN || props.ageRange[1] !== AGE_MAX) return true

  // Height range filter active
  if (props.heightRange && (props.heightRange[0] !== HEIGHT_MIN || props.heightRange[1] !== HEIGHT_MAX)) return true

  // Weight range filter active
  if (props.weightRange && (props.weightRange[0] !== WEIGHT_MIN || props.weightRange[1] !== WEIGHT_MAX)) return true

  // Years of service range filter active
  if (props.yearsOfServiceRange && (props.yearsOfServiceRange[0] !== YOS_MIN || props.yearsOfServiceRange[1] !== YOS_MAX)) return true

  // Trade filter active
  if (props.tradeFilter !== 'all') return true

  // Retired filter active
  if (props.retiredFilter !== 'all') return true

  // Nationality filter active
  if (props.selectedNationalities && props.selectedNationalities.length > 0) return true

  // Awards filter active
  if (props.selectedAwards && Object.keys(props.selectedAwards).length > 0) return true

  // Player search active
  if (props.playerSearch && props.playerSearch.trim() !== '') return true

  return false
})

// Count active filters
function getActiveFiltersCount(): number {
  let count = 0
  if (props.selectedTeam.length > 0) count++
  if (props.selectedOnceOwnedBy.length > 0) count++
  if (props.selectedPlaysFor.length > 0) count++
  if (!props.useYearRange && props.selectedYear !== null) count++
  if (props.useYearRange && (props.yearRange[0] !== YEAR_MIN || props.yearRange[1] !== YEAR_MAX)) count++
  if (props.selectedRounds.length > 0) count++
  if (props.overallPickRange[0] !== PICK_MIN || props.overallPickRange[1] !== PICK_MAX) count++
  if (props.preDraftTeamSearch.length > 0) count++
  if (props.selectedDraftCountries.length > 0) count++
  if (props.selectedPositions.length > 0) count++
  if (props.ageRange[0] !== AGE_MIN || props.ageRange[1] !== AGE_MAX) count++
  if (props.heightRange && (props.heightRange[0] !== HEIGHT_MIN || props.heightRange[1] !== HEIGHT_MAX)) count++
  if (props.weightRange && (props.weightRange[0] !== WEIGHT_MIN || props.weightRange[1] !== WEIGHT_MAX)) count++
  if (props.yearsOfServiceRange && (props.yearsOfServiceRange[0] !== YOS_MIN || props.yearsOfServiceRange[1] !== YOS_MAX)) count++
  if (props.tradeFilter !== 'all') count++
  if (props.retiredFilter !== 'all') count++
  if (props.selectedNationalities && props.selectedNationalities.length > 0) count++
  if (props.selectedAwards && Object.keys(props.selectedAwards).length > 0) count++
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

// The desktop table is a virtual table that scrolls inside its own wrapper, while the
// mobile card list scrolls the window. A capture-phase scroll listener catches both,
// since scroll events don't bubble but do fire during capture on ancestors.
function getTableScrollEl(): HTMLElement | null {
  return tableWrapEl.value?.querySelector('.v-table__wrapper') ?? null
}

function handleScroll(event?: Event) {
  const target = event?.target
  // Desktop: the virtual table scrolls inside its own wrapper.
  if (target instanceof HTMLElement && target.classList.contains('v-table__wrapper')) {
    showBackToTop.value = target.scrollTop > 300
    return
  }
  // Page-level scroll is dispatched on the document, <html>, or <body> depending on
  // the browser; any other element is an unrelated inner container (menus, sheets)
  // that should not drive the back-to-top button.
  if (
    target instanceof HTMLElement &&
    target !== document.documentElement &&
    target !== document.body
  ) {
    return
  }
  const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  showBackToTop.value = scrollTop > 300
}

function scrollToTop() {
  getTableScrollEl()?.scrollTo({ top: 0, behavior: 'smooth' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  loadTeams()
  // Capture phase so internal scroll containers (the virtual table) are observed too.
  window.addEventListener('scroll', handleScroll, true)
  handleScroll() // Check initial scroll position
  // rootMargin pre-fetches the next batch before the sentinel is fully on screen.
  mobileLoadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreMobileItems()
    },
    { rootMargin: '600px 0px' }
  )
  if (loadMoreSentinel.value) mobileLoadObserver.observe(loadMoreSentinel.value)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  cancelAnimationFrame(countRaf)
  mobileLoadObserver?.disconnect()
})

function getTeamLogoUrl(team: string, year?: number): string {
  // Use canonical team code for logo URL (aliases map to their canonical team's logo)
  const canonicalTeam = getCanonicalTeam(team, year)
  return `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${canonicalTeam.toLowerCase()}.svg`
}

function getPlayerHeadshotUrl(nbaId: string | number | undefined): string {
  if (!nbaId) return ''
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`
}

// Expose each row's drafting team color (shared with PlayerCard via team-colors.css)
// as a CSS variable so the hover ribbon/tint can theme per row.
function getTeamRowProps({ item }: { item: DraftPick }) {
  const code = getCanonicalTeam(item.team, item.year).toLowerCase()
  return {
    style: {
      '--row-team-primary': `var(--team-${code}-primary, rgb(var(--v-theme-primary)))`
    }
  }
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

const tradeChainCache = new Map<string, string[]>()

function getTradeChain(trades: string | null, year?: number): string[] {
  const key = `${trades ?? ''}|${year ?? ''}`
  if (tradeChainCache.has(key)) {
    return tradeChainCache.get(key)!
  }
  const result = parseTradeChain(trades, year)
  tradeChainCache.set(key, result)
  return result
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
    // 'primary' is now the red accent, so guards take the blue 'secondary' to stay distinct.
    case 'G':
      return 'secondary'
    case 'F':
      return 'success'
    case 'C':
      return 'warning'
    default:
      return 'primary'
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

const selectedPlayer = ref<DraftPick | null>(null)
const showPlayerCard = ref(false)
const showBackToTop = ref(false)
const tableWrapEl = ref<HTMLElement | null>(null)


function openPlayerCard(player: DraftPick) {
  selectedPlayer.value = player
  showPlayerCard.value = true
}

function getPlayerRetirementStatus(playedUntilYear: number | undefined): 'active' | 'retired' | 'unknown' {
  // If no retirement data, return unknown
  if (playedUntilYear === undefined) return 'unknown'
  return playedUntilYear < getCurrentSeasonStartYear() ? 'retired' : 'active'
}

// A rookie is an active player who has not yet completed an NBA season. This is a
// purely visual distinction; rookies still count as active players for filtering.
function isRookie(pick: DraftPick): boolean {
  return getPlayerRetirementStatus(pick.played_until_year) === 'active' && pick.yearsOfService === 0
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



// Helper function to describe active filters
function getActiveFiltersDescription(): string {
  const filters: string[] = []
  
  if (props.selectedTeam.length > 0) {
    const teamNames = props.selectedTeam.map(t => getTeamFullName(t)).join(', ')
    filters.push(`Drafted by: ${teamNames}`)
  }

  if (props.selectedOnceOwnedBy.length > 0) {
    const teamNames = props.selectedOnceOwnedBy.map(t => getTeamFullName(t)).join(', ')
    filters.push(`Once owned by: ${teamNames}`)
  }

  if (props.selectedPlaysFor.length > 0) {
    const teamNames = props.selectedPlaysFor.map(t => getTeamFullName(t)).join(', ')
    filters.push(`Currently plays for: ${teamNames}`)
  }
  
  if (!props.useYearRange && props.selectedYear !== null) {
    filters.push(`Year: ${props.selectedYear}`)
  } else if (props.useYearRange && (props.yearRange[0] !== YEAR_MIN || props.yearRange[1] !== YEAR_MAX)) {
    filters.push(`Year range: ${props.yearRange[0]}-${props.yearRange[1]}`)
  }

  if (props.selectedRounds.length > 0) {
    const rounds = props.selectedRounds.map(r => r === '3+' ? '3+' : `Round ${r}`).join(', ')
    filters.push(`Rounds: ${rounds}`)
  }

  if (props.overallPickRange[0] !== PICK_MIN || props.overallPickRange[1] !== PICK_MAX) {
    filters.push(`Pick range: ${props.overallPickRange[0]}-${props.overallPickRange[1]}`)
  }

  if (props.preDraftTeamSearch.length > 0) {
    filters.push(`Drafted from: ${props.preDraftTeamSearch.slice(0, 2).join(', ')}${props.preDraftTeamSearch.length > 2 ? '...' : ''}`)
  }

  if (props.selectedDraftCountries.length > 0) {
    const names = props.selectedDraftCountries
      .map((code) => code === NON_US_DRAFT_COUNTRY ? 'All non-US countries' : getFormattedCountryName(code))
      .slice(0, 2)
      .join(', ')
    filters.push(`Drafted from country: ${names}${props.selectedDraftCountries.length > 2 ? '...' : ''}`)
  }

  if (props.selectedPositions.length > 0) {
    filters.push(`Position: ${props.selectedPositions.join(', ')}`)
  }

  if (props.ageRange[0] !== AGE_MIN || props.ageRange[1] !== AGE_MAX) {
    filters.push(`Age: ${props.ageRange[0]}-${props.ageRange[1]}`)
  }

  if (props.heightRange && (props.heightRange[0] !== HEIGHT_MIN || props.heightRange[1] !== HEIGHT_MAX)) {
    filters.push(`Height: ${formatHeight(props.heightRange[0])}-${formatHeight(props.heightRange[1])}`)
  }

  if (props.weightRange && (props.weightRange[0] !== WEIGHT_MIN || props.weightRange[1] !== WEIGHT_MAX)) {
    filters.push(`Weight: ${props.weightRange[0]}-${props.weightRange[1]} lbs`)
  }

  if (props.yearsOfServiceRange && (props.yearsOfServiceRange[0] !== YOS_MIN || props.yearsOfServiceRange[1] !== YOS_MAX)) {
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
  <v-card class="draft-table">
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
            <span class="header-title">{{ headerTitle }}</span>
          </div>
          <div class="pick-stat" :class="isMobile ? 'ml-0 mt-1' : 'ml-3'">
            <span class="pick-stat__num tabular">{{ displayCount.toLocaleString() }}</span>
            <span class="pick-stat__label">picks</span>
          </div>
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
                variant="text"
                color="on-surface-variant"
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
                variant="text"
                color="on-surface-variant"
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
                variant="text"
                color="on-surface-variant"
                size="small"
                @click="copyUrlToClipboard"
              />
            </template>
          </v-tooltip>

          <!-- Columns Menu: show/hide, reorder (drag), and resize (header grip) -->
          <v-menu
            v-model="columnMenu"
            location="bottom end"
            :close-on-content-click="false"
          >
            <template #activator="{ props: menuProps }">
              <v-tooltip location="bottom" text="Customize columns — show/hide, reorder, resize">
                <template #activator="{ props: tooltipProps }">
                  <v-btn
                    v-bind="{ ...menuProps, ...tooltipProps }"
                    icon="mdi-view-column-outline"
                    variant="text"
                    color="on-surface-variant"
                    size="small"
                  />
                </template>
              </v-tooltip>
            </template>
            <v-card class="columns-card" min-width="320">
              <v-card-title class="d-flex align-center justify-space-between py-3 px-4">
                <div class="d-flex align-center text-subtitle-1">
                  <v-icon icon="mdi-view-column-outline" class="mr-2" size="20" />
                  Columns
                </div>
                <div class="d-flex align-center ga-1">
                  <v-btn
                    variant="text"
                    color="primary"
                    size="small"
                    :disabled="!hasCustomWidths"
                    @click="resetWidths"
                  >
                    Reset widths
                  </v-btn>
                  <v-btn
                    icon="mdi-refresh"
                    variant="text"
                    color="primary"
                    size="small"
                    title="Reset all column settings"
                    aria-label="Reset all column settings"
                    @click="resetColumns"
                  />
                </div>
              </v-card-title>
              <p class="px-4 pb-2 text-caption text-medium-emphasis">
                Drag to reorder · toggle to show or hide · drag a column's right edge in the table to resize.
              </p>
              <v-divider />
              <draggable
                v-model="orderedColumnList"
                item-key="key"
                handle=".col-drag-handle"
                class="columns-list"
              >
                <template #item="{ element }">
                  <div class="columns-list__row">
                    <v-icon class="col-drag-handle" icon="mdi-drag" size="20" />
                    <v-checkbox
                      :model-value="isColumnVisible(element.key)"
                      :label="element.title"
                      hide-details
                      density="compact"
                      class="flex-grow-1 ml-1"
                      @update:model-value="setColumnVisibility(element.key, !!$event)"
                    />
                  </div>
                </template>
              </draggable>
            </v-card>
          </v-menu>

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
                  variant="text"
                  color="on-surface-variant"
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
                <FilterPanel :mobile="false" v-bind="filterBind" />
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
            <FilterPanel :mobile="true" v-bind="filterBind" />
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
      
      <div v-if="!loading && items.length === 0" class="text-center pa-8">
        <v-icon icon="mdi-information-outline" size="48" color="info" class="mb-2" />
        <p class="text-h6">No draft picks found</p>
        <p class="text-body-2 text-medium-emphasis">Try adjusting your filters</p>
      </div>

      <template v-else>
        <MobileDraftCard
          v-for="item in mobileVisibleItems"
          :key="`${item.year}-${item.pick}-${item.player}`"
          :item="item"
          :show-player-measurements="showMeasurementsOnMobile"
          @player-click="openPlayerCard"
        />

        <!-- JIT loader: appends the next batch as it scrolls into view. -->
        <div
          v-if="hasMoreMobileItems"
          ref="loadMoreSentinel"
          class="mobile-load-sentinel"
        >
          <v-progress-circular indeterminate color="primary" size="28" />
        </div>
      </template>
    </div>

    <!-- Desktop Table View -->
    <div
      v-else
      ref="tableWrapEl"
      class="table-anim-wrap resizable-columns"
      :style="{ '--table-content-width': tableContentWidth + 'px' }"
      :key="tableAnimKey"
    >
    <v-data-table-virtual
      :headers="headers"
      :items="props.data"
      :loading="loading"
      :sort-by="sortBy"
      @update:sort-by="handleSortUpdate"
      :density="isMobile ? 'compact' : 'comfortable'"
      :row-props="getTeamRowProps"
      hover
      fixed-header
      :height="isMobile ? '500' : 'calc(100vh - 180px)'"
    >
      <template #header.team="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('team', $event)"
        />
      </template>
      <template #header.player="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('player', $event)"
        />
      </template>
      <template #header.year="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('year', $event)"
        />
      </template>
      <template #header.round="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('round', $event)"
        />
      </template>
      <template #header.pick="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('pick', $event)"
        />
      </template>
      <template #header.position="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('position', $event)"
        />
      </template>
      <template #header.height="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('height', $event)"
        />
      </template>
      <template #header.weight="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('weight', $event)"
        />
      </template>
      <template #header.age="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('age', $event)"
        />
      </template>
      <template #header.yearsOfService="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('yearsOfService', $event)"
        />
      </template>
      <template #header.preDraftTeam="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('preDraftTeam', $event)"
        />
      </template>
      <template #header.draftTrades="{ column, isSorted, getSortIcon }">
        <DraftColumnHeader
          :title="column.title ?? ''"
          :sortable="!!column.sortable"
          :is-sorted="isSorted(column)"
          :sort-icon="(getSortIcon(column) as string)"
          @resize-start="startColumnResize('draftTrades', $event)"
        />
      </template>

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
            <span class="font-weight-bold player-name">
              {{ item.player }}
              <!-- Deceased Indicator -->
              <v-icon
                v-if="item.is_defunct === 1"
                icon="mdi-grave-stone"
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
                  :icon="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'mdi-account-off' : isRookie(item) ? 'mdi-account-plus' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'mdi-account-check' : 'mdi-account-question'"
                  size="16"
                  :color="getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'grey' : isRookie(item) ? 'primary' : getPlayerRetirementStatus(item.played_until_year) === 'active' ? 'success' : 'warning'"
                  class="player-status-icon"
                />
              </template>
              <span v-if="isRookie(item)">
                Rookie<template v-if="item.plays_for"> for the {{ getTeamDisplayName(item.plays_for, item.year) }}</template>
              </span>
              <span v-else-if="getPlayerRetirementStatus(item.played_until_year) === 'active' && item.plays_for">
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
            <template v-for="(team, index) in getTradeChain(item.draftTrades, item.year)" :key="index">
              <span v-if="index > 0" class="mx-1 text-medium-emphasis">→</span>
              <v-avatar size="24" class="mr-1" rounded="0" style="background: transparent;">
                <v-img
                  :src="getTeamLogoUrl(team, item.year)"
                  :alt="getTeamDisplayName(team, item.year)"
                  contain
                />
              </v-avatar>
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

    </v-data-table-virtual>
    </div>

    <!-- Player Card Dialog -->
    <PlayerCard
      v-model="showPlayerCard"
      :player="selectedPlayer"
    />

    <!-- Back to Top Button — teleported to <body> so position:fixed resolves against
         the viewport rather than the animated (transformed) table card. -->
    <Teleport to="body">
      <v-fade-transition>
        <v-btn
          v-show="showBackToTop"
          class="back-to-top-btn"
          icon="mdi-chevron-up"
          color="primary"
          size="large"
          elevation="4"
          rounded="xl"
          @click="scrollToTop"
        />
      </v-fade-transition>
    </Teleport>
  </v-card>
</template>

<style scoped lang="scss">
.draft-table {
  animation: court-fade-rise 420ms var(--court-ease, ease) both;

  .sticky-table-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: rgb(var(--v-theme-surface));
    box-shadow: none;
    border-bottom: 1px solid var(--court-line, rgba(255, 255, 255, 0.1));
  }
  :deep(.v-data-table) {
    font-size: 0.875rem;
  }

  :deep(.v-data-table-header) {
    background-color: rgb(var(--v-theme-surface));
  }

  :deep(.v-data-table__th) {
    font-family: var(--font-display);
    font-weight: 600;
    white-space: nowrap;
    text-transform: uppercase;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: rgb(var(--v-theme-on-surface-variant));
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

  :deep(.v-data-table__tr) {
    transition: background-color var(--court-dur-hover, 150ms) var(--court-ease, ease);
  }

  :deep(.v-data-table__tr:hover) {
    background-color: color-mix(in srgb, var(--row-team-primary, rgb(var(--v-theme-primary))) 10%, rgb(var(--v-theme-surface)));
    box-shadow: inset 3px 0 0 0 var(--row-team-primary, rgb(var(--v-theme-primary)));
  }

  .trade-chain {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 2px;
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

  // Resizable columns: a fixed table layout makes the per-column pixel widths
  // authoritative (content clips instead of forcing a column wider), and the table
  // is given the summed content width so resizing overflows into horizontal scroll.
  .resizable-columns {
    :deep(table) {
      table-layout: fixed;
      width: var(--table-content-width, 100%);
      min-width: 100%;
    }

    :deep(.v-data-table__td),
    :deep(.v-data-table__th) {
      overflow: hidden;
    }
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
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
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

    // Spinner that anchors the just-in-time card loader.
    .mobile-load-sentinel {
      display: flex;
      justify-content: center;
      padding: 24px 0;
    }

    // Mobile shows the card list (no wide table), so the card must not become its own
    // scroll container — the overflow-x:auto below otherwise computes overflow-y to
    // auto, which scopes the header's position:sticky to the card instead of the
    // viewport and stops it sticking on scroll.
    &.draft-table {
      overflow: visible;
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

  .header-title {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-size: 1.35rem;
    line-height: 1.1;
  }

  .pick-stat {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .pick-stat__num {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.5rem;
    line-height: 1;
    color: rgb(var(--v-theme-primary));
  }

  .pick-stat__label {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 0.7rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgb(var(--v-theme-on-surface-variant));
  }

  // Player names are primary content, so they stay high-emphasis; red is reserved for accents.
  .player-name {
    color: rgb(var(--v-theme-on-surface));
  }

  // Virtual rows render only the visible window, so this stagger plays on the first
  // viewport and replays whenever the result set changes (via :key="tableAnimKey").
  .table-anim-wrap {
    :deep(.v-data-table__tr) {
      animation: court-fade-rise 300ms var(--court-ease, ease) both;

      @for $i from 1 through 18 {
        &:nth-child(#{$i}) {
          animation-delay: #{($i - 1) * 14}ms;
        }
      }
    }
  }

  @media (max-width: 959px) {
    .header-title {
      font-size: 1.15rem;
    }

    .pick-stat__num {
      font-size: 1.25rem;
    }
  }
}

// Back-to-Top button is teleported to <body>, so its style sits at the top level of
// the scoped block (not nested under .draft-table) to reach the teleported node.
.back-to-top-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  min-width: 48px;
  min-height: 48px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 959px) {
    bottom: 16px;
    right: 16px;
    min-width: 56px;
    min-height: 56px;
  }
}

// Columns menu lives in a teleported v-menu, so these rules sit at the top level of
// the scoped block (not nested under .draft-table) to reach the teleported content.
.columns-card {
  max-height: 70vh;
  overflow-y: auto;
}

.columns-list {
  padding: 4px 0 8px;
}

.columns-list__row {
  display: flex;
  align-items: center;
  padding: 2px 12px;
  border-radius: 6px;
  transition: background-color 120ms ease;

  &:hover {
    background-color: rgb(var(--v-theme-surface-bright));
  }

  .col-drag-handle {
    cursor: grab;
    color: rgb(var(--v-theme-on-surface-variant));

    &:active {
      cursor: grabbing;
    }
  }
}

@keyframes court-fade-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
