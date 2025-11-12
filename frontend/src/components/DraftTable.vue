<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { DraftPick } from '@/types/draft'
import type { TeamAbbreviation } from '@/types/team'
import { getCanonicalTeam, getDisplayTeam } from '@/utils/teamAliases'

interface DraftTableProps {
  data: DraftPick[]
  loading?: boolean
  selectedTeam?: TeamAbbreviation | 'ALL'
  yearRange?: [number, number]
  selectedRounds?: number[]
  overallPickRange?: [number, number]
  preDraftTeamSearch?: string
  tradeFilter?: 'all' | 'traded' | 'not-traded'
  availableYears?: number[]
  allPreDraftTeams?: string[]
}

const props = withDefaults(defineProps<DraftTableProps>(), {
  loading: false,
  selectedTeam: () => 'ALL',
  yearRange: () => [1950, 2025],
  selectedRounds: () => [],
  overallPickRange: () => [1, 420],
  preDraftTeamSearch: () => '',
  tradeFilter: () => 'all',
  availableYears: () => [],
  allPreDraftTeams: () => []
})

const emit = defineEmits<{
  'update:selectedTeam': [value: TeamAbbreviation | 'ALL']
  'update:yearRange': [value: [number, number]]
  'update:selectedRounds': [value: number[]]
  'update:overallPickRange': [value: [number, number]]
  'update:preDraftTeamSearch': [value: string]
  'update:tradeFilter': [value: 'all' | 'traded' | 'not-traded']
}>()

const filterMenu = ref(false)
const teams = ref<TeamAbbreviation[]>([])
const loadingTeams = ref(true)

interface TeamOption {
  value: TeamAbbreviation | 'ALL'
  title: string
  logo?: string
}

const teamOptions = ref<TeamOption[]>([])
const roundOptions = [1, 2, 3, 4, 5, 6, 7]

const minYear = computed(() => props.availableYears.length > 0 ? Math.min(...props.availableYears) : 1950)
const maxYear = computed(() => props.availableYears.length > 0 ? Math.max(...props.availableYears) : 2025)

async function loadTeams() {
  try {
    const response = await fetch('/data/teams.json')
    const data = await response.json() as TeamAbbreviation[]
    teams.value = data

    teamOptions.value = [
      { value: 'ALL', title: 'All Teams' },
      ...data.map((abbr) => ({
        value: abbr,
        title: abbr,
        logo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${abbr.toLowerCase()}.svg`
      }))
    ]
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
const sortBy = ref([
  { key: 'year', order: 'desc' },
  { key: 'pick', order: 'asc' }
])

function handleSortUpdate(newSort: Array<{ key: string; order: 'asc' | 'desc' }>) {
  // Only allow single column sorting - if user tries to sort multiple columns,
  // just use the first one
  if (newSort.length > 0) {
    sortBy.value = [newSort[0]]
  } else {
    // If all sorts cleared, restore default multi-sort
    sortBy.value = [
      { key: 'year', order: 'desc' },
      { key: 'pick', order: 'asc' }
    ]
  }
}

const items = computed(() => props.data)

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
        <v-avatar size="32" class="mr-2" rounded="0">
          <v-img
            src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
            alt="NBA"
            contain
          />
        </v-avatar>
        NBA Draft History
        <v-chip class="ml-2" color="primary" size="small" variant="flat">
          {{ items.length }} picks
        </v-chip>
      </div>
      <v-menu v-model="filterMenu" location="bottom end" :close-on-content-click="false">
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            icon="mdi-filter-variant"
            variant="outlined"
            color="primary"
            size="small"
          />
        </template>
        <v-card min-width="600" class="pa-4">
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
                  prepend-inner-icon="mdi-basketball"
                >
                  <template #item="{ props: itemProps, item }">
                    <v-list-item v-bind="itemProps">
                      <template #prepend v-if="item.raw.logo">
                        <v-avatar size="28" class="mr-2" rounded="0">
                          <v-img :src="item.raw.logo" :alt="item.raw.title" contain />
                        </v-avatar>
                      </template>
                    </v-list-item>
                  </template>

                  <template #selection="{ item }">
                    <div class="d-flex align-center">
                      <v-avatar v-if="item.raw.logo" size="24" class="mr-2" rounded="0">
                        <v-img :src="item.raw.logo" :alt="item.raw.title" contain />
                      </v-avatar>
                      <span>{{ item.raw.title }}</span>
                    </div>
                  </template>
                </v-select>
              </v-col>

              <!-- Year Range Filter -->
              <v-col cols="12" md="6">
                <div class="px-2">
                  <label class="text-caption text-medium-emphasis mb-2 d-block">Year Range</label>
                  <v-range-slider
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
                  <label class="text-caption text-medium-emphasis mb-2 d-block">Overall Pick Range</label>
                  <v-range-slider
                    :model-value="props.overallPickRange"
                    @update:model-value="emit('update:overallPickRange', $event)"
                    :min="1"
                    :max="420"
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
                  clearable
                  prepend-inner-icon="mdi-school"
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
      :items-per-page="50"
      :items-per-page-options="[
        { value: 25, title: '25' },
        { value: 50, title: '50' },
        { value: 100, title: '100' },
        { value: 250, title: '250' },
        { value: 500, title: '500' },
        { value: -1, title: 'All' }
      ]"
      v-model:sort-by="sortBy"
      @update:sort-by="handleSortUpdate"
      multi-sort
      items-per-page-text="Picks per page:"
      density="comfortable"
      hover
    >
      <template #item.team="{ item }">
        <div class="d-flex align-center">
          <v-avatar size="32" class="mr-2" rounded="0">
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
              <v-avatar size="24" class="mr-1" rounded="0">
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
  :deep(.v-avatar .v-img__img) {
    object-fit: contain !important;
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
