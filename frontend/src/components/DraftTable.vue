<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getCanonicalTeam, getDisplayTeam } from '@/utils/teamAliases'
import { getDataUrl } from '@/utils/dataUrl'

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
  tradeFilter?: 'all' | 'traded' | 'not-traded'
  availableYears?: number[]
  allPreDraftTeams?: string[]
}

const props = withDefaults(defineProps<DraftTableProps>(), {
  loading: false,
  selectedTeam: () => [],
  yearRange: () => [1950, 2025],
  selectedYear: null,
  useYearRange: () => true,
  selectedRounds: () => [],
  overallPickRange: () => [1, 61],
  preDraftTeamSearch: () => [],
  tradeFilter: () => 'all',
  availableYears: () => [],
  allPreDraftTeams: () => []
})

const emit = defineEmits<{
  'update:selectedTeam': [value: TeamAbbreviation[]]
  'update:yearRange': [value: [number, number]]
  'update:selectedYear': [value: number | null]
  'update:useYearRange': [value: boolean]
  'update:selectedRounds': [value: (number | string)[]]
  'update:overallPickRange': [value: [number, number]]
  'update:preDraftTeamSearch': [value: string[]]
  'update:tradeFilter': [value: 'all' | 'traded' | 'not-traded']
}>()

const filterMenu = ref(false)
const teams = ref<TeamAbbreviation[]>([])
const loadingTeams = ref(true)

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

const minYear = computed(() => props.availableYears.length > 0 ? Math.min(...props.availableYears) : 1950)
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


const headers = [
  { title: 'Team', key: 'team', sortable: true, minWidth: '40px' },
  { title: 'Player', key: 'player', sortable: true, minWidth: '75px' },
  { title: 'Year', key: 'year', sortable: true, width: '80px' },
  { title: 'Round', key: 'round', sortable: true, width: '80px' },
  { title: 'Overall Pick', key: 'pick', sortable: true, width: '35px' },
  { title: 'Position', key: 'position', sortable: true, width: '35px' },
  { title: 'Height', key: 'height', sortable: true, width: '35px' },
  { title: 'Weight', key: 'weight', sortable: true, width: '35px' },
  { title: 'Age', key: 'age', sortable: true, width: '35px' },
  { title: 'Pre-Draft Team', key: 'preDraftTeam', sortable: true, minWidth: '175px' },
  { title: 'Pick Trades', key: 'draftTrades', sortable: false, minWidth: '80px', width: 'auto' }
]

// Sort state - initial multi-sort by year (desc) and pick (asc)
// Users can only sort by single columns, but initial state uses multi-sort
type SortItem = { key: string; order: 'asc' | 'desc' }
const sortBy = ref<SortItem[]>([
  { key: 'year', order: 'desc' },
  { key: 'pick', order: 'asc' }
])

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
  if (props.useYearRange && (props.yearRange[0] !== 1950 || props.yearRange[1] !== 2025)) return true
  
  // Round filter active
  if (props.selectedRounds.length > 0) return true
  
  // Overall pick range active
  if (props.overallPickRange[0] !== 1 || props.overallPickRange[1] !== 61) return true
  
  // Pre-draft team filter active
  if (props.preDraftTeamSearch.length > 0) return true
  
  // Trade filter active
  if (props.tradeFilter !== 'all') return true
  
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
})

function getTeamLogoUrl(team: string): string {
  // Use canonical team code for logo URL (aliases map to their canonical team's logo)
  const canonicalTeam = getCanonicalTeam(team)
  return `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${canonicalTeam.toLowerCase()}.svg`
}

function getOriginalTeam(trades: string | null): string | null {
  if (!trades || trades.trim() === '') return null

  // Parse trade chain format like "NOP to  ATL" or "CHA to  BOS BOS  to ATL"
  // Extract the first team (original drafter)
  const firstToIndex = trades.indexOf(' to ')
  if (firstToIndex === -1) return null

  const original = trades.substring(0, firstToIndex).trim()
  if (!original) return null

  // Return the display name (preserves alias if it's an alias)
  return getDisplayTeam(original)
}

function isDifferentTeam(originalTeam: string | null, currentTeam: string): boolean {
  if (!originalTeam) return false
  return getCanonicalTeam(originalTeam) !== getCanonicalTeam(currentTeam)
}

function parseTradeChain(trades: string | null): string[] {
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
    displayTeams.push(getDisplayTeam(firstTeam))
    canonicalTeams.push(getCanonicalTeam(firstTeam))
  }

  // For each subsequent part, extract the team at the beginning
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    // Split by spaces and take the first word (the team abbreviation)
    const team = part.split(/\s+/)[0]
    if (team && team.length <= 4) { // Team abbreviations are typically 3-4 characters
      displayTeams.push(getDisplayTeam(team))
      canonicalTeams.push(getCanonicalTeam(team))
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
      <v-menu v-model="filterMenu" location="bottom end" :close-on-content-click="false">
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
            />
          </v-badge>
        </template>
        <v-card min-width="600" max-width="600" class="pa-4">
          <v-card-title class="d-flex align-center mb-4">
            <v-icon icon="mdi-filter-variant" class="mr-2" />
            Filters
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <!-- Team Filter -->
              <v-col cols="12" md="6">
                <v-select
                  :model-value="props.selectedTeam"
                  @update:model-value="emit('update:selectedTeam', $event)"
                  :items="teamOptions"
                  :loading="loadingTeams"
                  label="Team"
                  variant="outlined"
                  density="compact"
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
              <v-col cols="12" md="6">
                <div class="px-2">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <label class="text-caption text-medium-emphasis">Year</label>
                    <v-btn-toggle
                      :model-value="props.useYearRange ? 'range' : 'single'"
                      @update:model-value="emit('update:useYearRange', $event === 'range')"
                      density="compact"
                      variant="outlined"
                      mandatory
                    >
                      <v-btn value="single" size="small">Single</v-btn>
                      <v-btn value="range" size="small">Range</v-btn>
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
                    hide-details
                    color="primary"
                    class="mt-4"
                  />
                  <v-select
                    v-else
                    :model-value="props.selectedYear"
                    @update:model-value="emit('update:selectedYear', $event)"
                    :items="props.availableYears"
                    label="Select Year"
                    variant="outlined"
                    density="compact"
                    hide-details
                    clearable
                    class="mt-2"
                  />
                </div>
              </v-col>

              <!-- Round Filter -->
              <v-col cols="12" md="6">
                <v-select
                  :model-value="props.selectedRounds"
                  @update:model-value="emit('update:selectedRounds', $event)"
                  :items="roundOptions"
                  label="Rounds"
                  variant="outlined"
                  density="compact"
                  multiple
                  chips
                  hide-details
                  prepend-inner-icon="mdi-numeric"
                />
              </v-col>

              <!-- Overall Pick Range -->
              <v-col cols="12" md="6">
                <div class="px-2">
                  <label class="text-caption text-medium-emphasis mb-2 d-block">
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
                    hide-details
                    color="primary"
                    class="mt-4"
                  />
                </div>
              </v-col>

              <!-- Pre-Draft Team Search -->
              <v-col cols="12" md="6">
                <v-autocomplete
                  :model-value="props.preDraftTeamSearch"
                  @update:model-value="emit('update:preDraftTeamSearch', $event)"
                  :items="props.allPreDraftTeams"
                  label="Pre-Draft Team"
                  variant="outlined"
                  density="compact"
                  hide-details
                  multiple
                  chips
                  clearable
                  prepend-inner-icon="mdi-school"
                  closable-chips
                />
              </v-col>

              <!-- Trade Filter -->
              <v-col cols="12" md="6">
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
                  density="compact"
                  hide-details
                  prepend-inner-icon="mdi-swap-horizontal"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-menu>
    </v-card-title>

    <v-data-table
      :headers="headers"
      :items="items"
      :loading="loading"
      :items-per-page="30"
      :items-per-page-options="[
        { value: 30, title: '30' },
        { value: 60, title: '60' },
        { value: 100, title: '100' },
        { value: 250, title: '250' },
        { value: 500, title: '500' },
        { value: -1, title: 'All' }
      ]"
      :sort-by="sortBy"
      @update:sort-by="handleSortUpdate"
      items-per-page-text="Picks per page:"
      density="comfortable"
      hover
    >
      <template #item.team="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="32" class="mr-2" rounded="0" style="background: transparent;">
            <v-img
              :src="getTeamLogoUrl(item.team)"
              :alt="item.team"
              contain
            />
          </v-avatar>
          <div class="d-flex flex-column">
            <span class="font-weight-medium">{{ item.team }}</span>
            <span
              v-if="isDifferentTeam(getOriginalTeam(item.draftTrades), item.team)"
              class="text-caption text-medium-emphasis"
            >
              (via {{ getOriginalTeam(item.draftTrades) }})
            </span>
          </div>
        </div>
      </template>

      <template #item.player="{ item }">
        <span class="font-weight-bold text-primary">{{ item.player }}</span>
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
        <v-chip size="small" variant="outlined">
          {{ item.age || '-' }}
        </v-chip>
      </template>

      <template #item.preDraftTeam="{ item }">
        <span class="text-medium-emphasis pre-draft-team-text">{{ item.preDraftTeam || '-' }}</span>
      </template>

      <template #item.draftTrades="{ item }">
        <template v-if="item.draftTrades">
          <div class="trade-chain">
            <template v-for="(team, index) in parseTradeChain(item.draftTrades)" :key="index">
              <v-avatar size="24" class="mr-1" rounded="0" style="background: transparent;">
                <v-img
                  :src="getTeamLogoUrl(team)"
                  :alt="team"
                  contain
                />
              </v-avatar>
              <span v-if="index < parseTradeChain(item.draftTrades).length - 1" class="mx-1 text-medium-emphasis">→</span>
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

  // Hide sort priority numbers (for initial multi-sort)
  :deep(.v-data-table-header__sort-badge),
  :deep(.v-data-table__sort-badge) {
    display: none !important;
  }

  :deep(.v-data-table__td) {
    white-space: nowrap;
    padding: 16px 28px !important;
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
  
  // Ensure filter menu card maintains fixed width
  :deep(.v-menu__content) {
    max-width: 600px !important;
  }

  .pre-draft-team-text {
    word-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    max-width: 20ch;
    display: inline-block;
  }

  // Allow Pre-Draft Team column to wrap
  :deep(.v-data-table__td:nth-child(10)) {
    white-space: normal !important;
  }
}
</style>
