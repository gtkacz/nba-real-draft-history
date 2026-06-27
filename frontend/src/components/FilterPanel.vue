<script setup lang="ts">
import { computed } from 'vue'
import { VAutocomplete, VSelect } from 'vuetify/components'
import type { TeamAbbreviation } from '@/types/team'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { formatHeight } from '@/utils/formatHeight'
import {
  YEAR_MIN, YEAR_MAX,
  PICK_MIN, PICK_MAX,
  AGE_MIN, AGE_MAX,
  HEIGHT_MIN, HEIGHT_MAX,
  WEIGHT_MIN, WEIGHT_MAX,
  YOS_MIN, YOS_MAX,
  createDefaultExcludeModes,
  type ExcludableFilterKey,
  type ExcludeModes,
  type OnceOwnedByScope
} from '@/constants/filters'
import FilterModeToggle from './FilterModeToggle.vue'

interface TeamOption {
  value: TeamAbbreviation
  title: string
  logo?: string
}

interface NationalityOption {
  value: string
  title: string
  flag?: string
}

interface DraftCountryOption {
  value: string
  title: string
  flag?: string
}

const props = defineProps<{
  // When true, render the touch-optimized variant used inside the mobile bottom sheet.
  mobile?: boolean
  teamOptions: TeamOption[]
  nationalityOptions: NationalityOption[]
  draftCountryOptions: DraftCountryOption[]
  loadingTeams: boolean
  allPreDraftTeams: string[]
  availableYears: number[]
  availableAges: number[]
  availableAwards: string[]
  minHeight: number
  maxHeight: number
  minWeight: number
  maxWeight: number
  minYearsOfService: number
  maxYearsOfService: number
}>()

const selectedTeam = defineModel<TeamAbbreviation[]>('selectedTeam', { default: () => [] })
const selectedOnceOwnedBy = defineModel<TeamAbbreviation[]>('selectedOnceOwnedBy', { default: () => [] })
const selectedPlaysFor = defineModel<TeamAbbreviation[]>('selectedPlaysFor', { default: () => [] })
const selectedNationalities = defineModel<string[]>('selectedNationalities', { default: () => [] })
const preDraftTeamSearch = defineModel<string[]>('preDraftTeamSearch', { default: () => [] })
const selectedDraftCountries = defineModel<string[]>('selectedDraftCountries', { default: () => [] })
const selectedPositions = defineModel<string[]>('selectedPositions', { default: () => [] })
const selectedRounds = defineModel<(number | string)[]>('selectedRounds', { default: () => [] })
const tradeFilter = defineModel<'all' | 'traded' | 'not-traded'>('tradeFilter', { default: 'all' })
const retiredFilter = defineModel<'all' | 'retired' | 'not-retired'>('retiredFilter', { default: 'all' })
const useYearRange = defineModel<boolean>('useYearRange', { default: true })
const yearRange = defineModel<[number, number]>('yearRange', { default: () => [YEAR_MIN, YEAR_MAX] })
const selectedYear = defineModel<number | null>('selectedYear', { default: null })
const overallPickRange = defineModel<[number, number]>('overallPickRange', { default: () => [PICK_MIN, PICK_MAX] })
const ageRange = defineModel<[number, number]>('ageRange', { default: () => [AGE_MIN, AGE_MAX] })
const heightRange = defineModel<[number, number]>('heightRange', { default: () => [HEIGHT_MIN, HEIGHT_MAX] })
const weightRange = defineModel<[number, number]>('weightRange', { default: () => [WEIGHT_MIN, WEIGHT_MAX] })
const yearsOfServiceRange = defineModel<[number, number]>('yearsOfServiceRange', { default: () => [YOS_MIN, YOS_MAX] })
const selectedAwards = defineModel<Record<string, number>>('selectedAwards', { default: () => ({}) })
const awardFilterMode = defineModel<'exclusive' | 'inclusive'>('awardFilterMode', { default: 'exclusive' })
const excludeModes = defineModel<ExcludeModes>('excludeModes', { default: () => createDefaultExcludeModes() })
const onceOwnedByScope = defineModel<OnceOwnedByScope>('onceOwnedByScope', { default: 'first' })

function isExcluded(key: ExcludableFilterKey): boolean {
  return Boolean(excludeModes.value[key])
}

// Immutable update so the parent's watcher sees a new object.
function toggleExclude(key: ExcludableFilterKey): void {
  excludeModes.value = { ...excludeModes.value, [key]: !excludeModes.value[key] }
}

// A field reads as negated (red) only when it is in exclude mode AND has at least
// one selection; an exclude flag with no selections is inert and stays neutral.
function negatedColor(key: ExcludableFilterKey, count: number): string | undefined {
  return isExcluded(key) && count > 0 ? 'error' : undefined
}

const positionOptions = [
  { value: 'G', title: 'Guard (G)' },
  { value: 'F', title: 'Forward (F)' },
  { value: 'C', title: 'Center (C)' }
]

const roundOptions = [
  { value: 1, title: 'Round 1' },
  { value: 2, title: 'Round 2' },
  { value: '3+', title: 'Round 3+' }
]

// Fallback bounds mirror the original inline defaults when no ages are loaded yet.
const minAge = computed(() => props.availableAges.length > 0 ? Math.min(...props.availableAges) : 17)
const maxAge = computed(() => props.availableAges.length > 0 ? Math.max(...props.availableAges) : 50)

const sortedAwards = computed(() => {
  if (!props.availableAwards || props.availableAwards.length === 0) {
    return []
  }
  return [...props.availableAwards].sort()
})

// One-time-only awards (e.g. All-Rookie variants) are boolean filters with no count input.
function shouldShowAwardCount(award: string): boolean {
  return !award.toLowerCase().includes('all-rookie')
}

function formatAwardName(award: string): string {
  return award
}

function handleAwardCheckboxChange(award: string, checked: boolean) {
  const current = { ...selectedAwards.value }
  if (checked) {
    current[award] = 1
  } else {
    delete current[award]
  }
  selectedAwards.value = current
}

function handleAwardCountChange(award: string, count: number) {
  if (count < 1) return
  selectedAwards.value = { ...selectedAwards.value, [award]: count }
}
</script>

<template>
  <!-- Quadrant 1: Team, Nationality, Drafted From -->
  <div :class="mobile ? 'pa-4 pb-3' : 'pa-4 pb-2'">
    <v-row>
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-autocomplete
          v-model="selectedTeam"
          :items="teamOptions"
          :loading="loadingTeams"
          :label="mobile ? 'Team' : 'Drafted By'"
          variant="outlined"
          hide-details
          multiple
          chips
          clearable
          persistent-clear
          closable-chips
          :base-color="negatedColor('team', selectedTeam.length)"
          :color="negatedColor('team', selectedTeam.length)"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="selectedTeam.length > 0"
              :excluded="isExcluded('team')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('team')"
            />
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
              :color="negatedColor('team', selectedTeam.length)"
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
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-autocomplete
          v-model="selectedPlaysFor"
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
          :base-color="negatedColor('playsFor', selectedPlaysFor.length)"
          :color="negatedColor('playsFor', selectedPlaysFor.length)"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="selectedPlaysFor.length > 0"
              :excluded="isExcluded('playsFor')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('playsFor')"
            />
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
              :color="negatedColor('playsFor', selectedPlaysFor.length)"
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

      <!-- Nationality: autocomplete on desktop, select (larger touch target) on mobile -->
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <component
          :is="mobile ? VSelect : VAutocomplete"
          v-model="selectedNationalities"
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
          :base-color="negatedColor('nationalities', selectedNationalities.length)"
          :color="negatedColor('nationalities', selectedNationalities.length)"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="selectedNationalities.length > 0"
              :excluded="isExcluded('nationalities')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('nationalities')"
            />
            <v-icon v-if="!mobile" icon="mdi-flag" size="20" class="mr-2" />
            <div v-else class="team-logo-container mr-2" style="width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
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
              :color="negatedColor('nationalities', selectedNationalities.length)"
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
        </component>
      </v-col>

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-autocomplete
          v-model="preDraftTeamSearch"
          :items="allPreDraftTeams"
          label="Drafted From"
          variant="outlined"
          hide-details
          multiple
          chips
          clearable
          persistent-clear
          closable-chips
          :base-color="negatedColor('preDraftTeam', preDraftTeamSearch.length)"
          :color="negatedColor('preDraftTeam', preDraftTeamSearch.length)"
          :chip-props="negatedColor('preDraftTeam', preDraftTeamSearch.length) ? { color: 'error' } : undefined"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="preDraftTeamSearch.length > 0"
              :excluded="isExcluded('preDraftTeam')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('preDraftTeam')"
            />
            <v-icon icon="mdi-school" size="20" class="mr-2" />
          </template>
        </v-autocomplete>
      </v-col>

      <!-- Drafted From Country: country parsed from the pre-draft team. Selecting
           a country in IS NOT mode replaces the former "all non-US" umbrella. -->
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <component
          :is="mobile ? VSelect : VAutocomplete"
          v-model="selectedDraftCountries"
          :items="draftCountryOptions"
          label="Drafted From Country"
          variant="outlined"
          hide-details
          multiple
          chips
          clearable
          persistent-clear
          closable-chips
          :base-color="negatedColor('draftCountries', selectedDraftCountries.length)"
          :color="negatedColor('draftCountries', selectedDraftCountries.length)"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="selectedDraftCountries.length > 0"
              :excluded="isExcluded('draftCountries')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('draftCountries')"
            />
            <v-icon icon="mdi-earth" size="20" class="mr-2" />
          </template>
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <div class="team-logo-container mr-2" style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  <span
                    v-if="item.raw.flag"
                    :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                    style="font-size: 24px;"
                  />
                  <v-icon v-else icon="mdi-earth" size="24" />
                </div>
              </template>
            </v-list-item>
          </template>

          <template #selection="{ item }">
            <v-chip
              v-if="item.raw"
              size="small"
              class="mr-1"
              :color="negatedColor('draftCountries', selectedDraftCountries.length)"
            >
              <span
                v-if="item.raw.flag"
                :class="`fi fi-${getCountryCode(item.raw.flag)}`"
                class="mr-1"
                style="font-size: 16px; vertical-align: middle;"
              />
              <v-icon v-else icon="mdi-earth" size="16" class="mr-1" />
              <span>{{ item.raw.title }}</span>
            </v-chip>
          </template>
        </component>
      </v-col>

      <!-- Once Owned By: a team in a pick's trade chain. The scope toggle below
           the field switches between matching the original owner only and any
           owner along the chain. -->
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-autocomplete
          v-model="selectedOnceOwnedBy"
          :items="teamOptions"
          :loading="loadingTeams"
          label="Once Owned By"
          variant="outlined"
          hide-details
          multiple
          chips
          clearable
          persistent-clear
          closable-chips
          :base-color="negatedColor('onceOwnedBy', selectedOnceOwnedBy.length)"
          :color="negatedColor('onceOwnedBy', selectedOnceOwnedBy.length)"
        >
          <template #prepend-inner>
            <FilterModeToggle
              v-if="selectedOnceOwnedBy.length > 0"
              :excluded="isExcluded('onceOwnedBy')"
              :mobile="mobile ?? false"
              @toggle="toggleExclude('onceOwnedBy')"
            />
            <v-icon icon="mdi-swap-horizontal" size="20" class="mr-2" />
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
              :color="negatedColor('onceOwnedBy', selectedOnceOwnedBy.length)"
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

        <!-- Trade-chain scope, mirroring the Awards All/Any segmented control. -->
        <div v-if="selectedOnceOwnedBy.length > 0" class="owned-scope-row mt-2">
          <span class="text-caption text-medium-emphasis owned-scope-label">Match as</span>
          <v-tooltip location="bottom" max-width="300">
            <template #activator="{ props: tooltipProps }">
              <v-btn-toggle
                v-model="onceOwnedByScope"
                v-bind="tooltipProps"
                mandatory
                variant="outlined"
                class="owned-scope-toggle"
              >
                <v-btn value="first">First owner</v-btn>
                <v-btn value="any">Any owner</v-btn>
              </v-btn-toggle>
            </template>
            <span>First owner: matches only the team that originally held the pick (head of the trade chain).<br>Any owner: matches the team anywhere along the trade chain.</span>
          </v-tooltip>
        </div>
      </v-col>
    </v-row>
  </div>

  <v-divider :class="mobile ? 'my-2' : ''"></v-divider>

  <!-- Quadrant 2: Position, Round, Trade Status -->
  <div :class="mobile ? 'pa-4 pb-3' : 'pa-4 pb-2'">
    <v-row>
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-select
          v-model="selectedPositions"
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

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-select
          v-model="selectedRounds"
          :items="roundOptions"
          label="Rounds"
          variant="outlined"
          multiple
          chips
          hide-details
          prepend-inner-icon="mdi-numeric"
        />
      </v-col>

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-select
          v-model="tradeFilter"
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

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <v-select
          v-model="retiredFilter"
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

  <v-divider :class="mobile ? 'my-2' : ''"></v-divider>

  <!-- Quadrant 3: Year, Overall Pick, Age -->
  <div :class="mobile ? 'pa-4 pb-3' : 'pa-4 pb-2'">
    <v-row>
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <div class="d-flex align-center justify-space-between mb-3">
            <label class="text-caption text-medium-emphasis">Year</label>
            <v-btn-toggle
              :model-value="useYearRange ? 'range' : 'single'"
              @update:model-value="useYearRange = $event === 'range'"
              variant="outlined"
              mandatory
              class="year-mode-toggle"
            >
              <v-btn value="single">Single</v-btn>
              <v-btn value="range">Range</v-btn>
            </v-btn-toggle>
          </div>
          <v-range-slider
            v-if="useYearRange"
            v-model="yearRange"
            :min="YEAR_MIN"
            :max="YEAR_MAX"
            :step="1"
            thumb-label="always"
            thumb-label-location="bottom"
            hide-details
            color="primary"
            class="mt-2"
          />
          <v-select
            v-else
            v-model="selectedYear"
            :items="availableYears"
            label="Select Year"
            variant="outlined"
            hide-details
            clearable
            persistent-clear
            class="mt-2"
          />
        </div>
      </v-col>

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <label class="text-caption text-medium-emphasis mb-3 d-block">
            Overall Pick Range
            <span v-if="overallPickRange && overallPickRange[1] === 61" class="ml-2 text-primary">
              (61+)
            </span>
          </label>
          <v-range-slider
            v-model="overallPickRange"
            :min="PICK_MIN"
            :max="PICK_MAX"
            :step="1"
            thumb-label="always"
            thumb-label-location="bottom"
            hide-details
            color="primary"
            class="mt-2"
          />
        </div>
      </v-col>

      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <label class="text-caption text-medium-emphasis mb-3 d-block">Age Range</label>
          <v-range-slider
            v-model="ageRange"
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

  <v-divider :class="mobile ? 'my-2' : ''"></v-divider>

  <!-- Quadrant 4: Player Measurements -->
  <div :class="mobile ? 'pa-4 pb-4' : 'pa-4'">
    <v-row>
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <label class="text-caption text-medium-emphasis mb-3 d-block">
            Height Range
            <span class="ml-2 text-primary">
              ({{ formatHeight(heightRange[0]) }} - {{ formatHeight(heightRange[1]) }})
            </span>
          </label>
          <v-range-slider
            v-model="heightRange"
            :min="minHeight"
            :max="maxHeight"
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
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <label class="text-caption text-medium-emphasis mb-3 d-block">
            Weight Range
            <span class="ml-2 text-primary">
              ({{ weightRange[0] }} - {{ weightRange[1] }} lbs)
            </span>
          </label>
          <v-range-slider
            v-model="weightRange"
            :min="minWeight"
            :max="maxWeight"
            :step="1"
            thumb-label="always"
            thumb-label-location="bottom"
            hide-details
            color="primary"
            class="mt-2"
          >
          </v-range-slider>
        </div>
      </v-col>
      <v-col cols="12" md="6" :class="mobile ? 'mb-3' : 'mb-2'">
        <div class="px-1 slider-field">
          <label class="text-caption text-medium-emphasis mb-3 d-block">
            Years in the League Range
            <span class="ml-2 text-primary">
              ({{ yearsOfServiceRange[0] }} - {{ yearsOfServiceRange[1] }} years)
            </span>
          </label>
          <v-range-slider
            v-model="yearsOfServiceRange"
            :min="minYearsOfService"
            :max="maxYearsOfService"
            :step="1"
            thumb-label="always"
            thumb-label-location="bottom"
            hide-details
            color="primary"
            class="mt-2"
          >
          </v-range-slider>
        </div>
      </v-col>
    </v-row>
  </div>

  <v-divider v-if="availableAwards && availableAwards.length > 0" :class="mobile ? 'my-2' : ''"></v-divider>

  <!-- Awards Filter Section -->
  <div v-if="availableAwards && availableAwards.length > 0" :class="mobile ? 'pa-4 pb-3' : 'pa-4 pb-2'">
    <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon icon="mdi-star" size="20" class="mr-2" />
        Awards
      </div>
      <v-tooltip location="bottom" max-width="300">
        <template v-slot:activator="{ props: tooltipProps }">
          <v-btn-toggle
            v-model="awardFilterMode"
            variant="outlined"
            mandatory
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
          :model-value="award in (selectedAwards || {})"
          @update:model-value="handleAwardCheckboxChange(award, !!$event)"
          :label="formatAwardName(award)"
          hide-details
          density="comfortable"
          class="flex-grow-1 mr-2"
        />
        <v-text-field
          v-if="award in (selectedAwards || {}) && shouldShowAwardCount(award)"
          :model-value="(selectedAwards || {})[award] || 1"
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
</template>

<style scoped lang="scss">
// Range slider value bubbles render above the thumb by default, where they collide
// with the field label sitting directly above each slider. Anchor them below the
// track instead, and reserve room beneath each slider so they don't overlap the
// next row.
:deep(.v-slider-thumb__label) {
  top: 22px !important;
  bottom: auto !important;
}

.slider-field {
  padding-bottom: 30px;
}

// Give the Year Single/Range and Awards All/Any segmented controls more
// breathing room than the dense default, so the options read as proper
// tappable targets.
.year-mode-toggle :deep(.v-btn),
.award-mode-toggle :deep(.v-btn) {
  min-height: 25px;
  padding-inline: 24px;
  letter-spacing: 0.02em;
}

// The "Once Owned By" trade-chain scope toggle sits beneath its field; its
// labels are longer, so it uses tighter horizontal padding and may wrap below
// the caption on narrow columns.
.owned-scope-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.owned-scope-label {
  flex-shrink: 0;
}

.owned-scope-toggle :deep(.v-btn) {
  min-height: 28px;
  padding-inline: 14px;
  letter-spacing: 0.02em;
}

// Team/nationality logos in the autocomplete/select fields must not be clipped.
.team-logo-container {
  overflow: visible !important;
  background: transparent !important;

  img {
    object-fit: contain !important;
    display: block;
  }
}

:deep(.v-list-item__prepend) {
  width: auto !important;
  min-width: auto !important;
  overflow: visible !important;
}

// Keep selected-chip rows from forcing the field to grow; let them scroll instead.
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

:deep(.v-select__selection .v-chip),
:deep(.v-autocomplete__selection .v-chip) {
  flex-shrink: 0;
}

@media (max-width: 959px) {
  // Larger touch targets on mobile.
  :deep(.v-slider-thumb) {
    width: 20px !important;
    height: 20px !important;
  }

  :deep(.v-btn-toggle .v-btn) {
    min-height: 44px;
    padding: 8px 16px;
  }

  :deep(.v-select__selection .v-chip),
  :deep(.v-autocomplete__selection .v-chip) {
    margin: 2px 4px 2px 0;
  }
}
</style>
