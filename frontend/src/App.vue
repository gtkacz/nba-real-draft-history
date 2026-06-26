<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import DraftTable from './components/DraftTable.vue'
import AppFooter from './components/AppFooter.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import { useSplashScreen } from './composables/useSplashScreen'
import { useDraftData } from './composables/useDraftData'
import { useFilterUrlSync } from './composables/useFilterUrlSync'
import { useCountryData } from './composables/useCountryData'
import { useTeamData } from './composables/useTeamData'
import { initializeCache } from './utils/csvCache'

const { showSplash, markSplashSeen } = useSplashScreen()
const { loadCountryData } = useCountryData()
const { loadTeamData, getAllTeamAbbreviations } = useTeamData()
const {
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
  loadAllTeamData
} = useDraftData()

const showPlayerMeasurements = ref(false)

// Sync filters with URL query strings
const { resetFilters: resetFiltersFromUrl } = useFilterUrlSync({
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
  showPlayerMeasurements
})

// Use the resetFilters from URL sync (it now includes playerSearch)
const resetFilters = resetFiltersFromUrl

async function loadData() {
  try {
    await loadTeamData()
    const teams = getAllTeamAbbreviations()
    await loadAllTeamData(teams)
  } catch (err) {
    console.error('Error in loadData:', err)
  }
}

onMounted(() => {
  // Initialize cache first (check version and invalidate if needed)
  initializeCache()
  loadData()
  loadCountryData()
})
</script>

<template>
  <v-app>
    <SplashScreen v-if="showSplash" @continue="markSplashSeen" />

    <v-app-bar flat color="surface" density="compact" class="command-bar">
      <div class="brand">
        <span class="brand-accent" aria-hidden="true"></span>
        <img
          src="https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/nba.svg"
          alt="NBA logo"
          class="brand-logo"
        />
        <span class="brand-wordmark">Real Draft History</span>
      </div>

      <v-spacer />

      <ThemeToggle />

      <v-btn
        icon="mdi-github"
        color="on-surface-variant"
        variant="text"
        href="https://github.com/gtkacz/nba-real-draft-history"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
      />
    </v-app-bar>

    <v-main>
      <v-container fluid class="table-container">
        <v-row>
          <v-col cols="12">
            <DraftTable
              :data="filteredData"
              :loading="loading"
              v-model:selected-team="selectedTeam"
              v-model:selected-plays-for="selectedPlaysFor"
              v-model:year-range="yearRange"
              v-model:selected-year="selectedYear"
              v-model:use-year-range="useYearRange"
              v-model:selected-rounds="selectedRounds"
              v-model:overall-pick-range="overallPickRange"
              v-model:pre-draft-team-search="preDraftTeamSearch"
              v-model:selected-positions="selectedPositions"
              v-model:age-range="ageRange"
              v-model:height-range="heightRange"
              v-model:weight-range="weightRange"
              v-model:years-of-service-range="yearsOfServiceRange"
              v-model:trade-filter="tradeFilter"
              v-model:retired-filter="retiredFilter"
              v-model:selected-nationalities="selectedNationalities"
              v-model:selected-awards="selectedAwards"
              v-model:award-filter-mode="awardFilterMode"
              v-model:player-search="playerSearch"
              v-model:sort-by="sortBy"
              v-model:current-page="currentPage"
              v-model:items-per-page="itemsPerPage"
              v-model:show-player-measurements="showPlayerMeasurements"
              :available-years="availableYears"
              :all-pre-draft-teams="allPreDraftTeams"
              :available-ages="availableAges"
              :available-nationalities="availableNationalities"
              :available-awards="availableAwards"
              :min-height="minHeight"
              :max-height="maxHeight"
              :min-weight="minWeight"
              :max-weight="maxWeight"
              :min-years-of-service="minYearsOfService"
              :max-years-of-service="maxYearsOfService"
              :reset-filters="resetFilters"
            />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-divider class="mt-8" />

    <AppFooter />
  </v-app>
</template>

<style scoped>
.v-main {
  min-height: calc(100vh - 64px - 72px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-left: 4px;
}

.brand-accent {
  width: 3px;
  height: 22px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}

.brand-logo {
  width: 26px;
  height: 26px;
  display: block;
}

.brand-wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  color: rgb(var(--v-theme-on-surface));
}

.table-container {
  padding: 8px 4px 0 !important;
  max-width: 100%;
}

@media (min-width: 600px) {
  .table-container {
    padding: 16px 12px 0 !important;
  }
}

@media (min-width: 960px) {
  .table-container {
    padding: 2vw 10vw 0 !important;
  }
}

@media (min-width: 1280px) {
  .table-container {
    padding: 1.5vw 10vw 0 !important;
  }
}
</style>
