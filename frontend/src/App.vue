<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DraftTable from './components/DraftTable.vue'
import AppFooter from './components/AppFooter.vue'
import { useSplashScreen } from './composables/useSplashScreen'
import { useDraftData } from './composables/useDraftData'
import { useFilterUrlSync } from './composables/useFilterUrlSync'
import { useCountryData } from './composables/useCountryData'
import { getDataUrl } from './utils/dataUrl'
import type { TeamAbbreviation } from './types/team'

const { showSplash, markSplashSeen } = useSplashScreen()
const { loadCountryData } = useCountryData()
const {
  selectedTeam,
  selectedYear,
  yearRange,
  useYearRange,
  selectedRounds,
  overallPickRange,
  preDraftTeamSearch,
  selectedPositions,
  ageRange,
  tradeFilter,
  selectedNationalities,
  sortBy,
  currentPage,
  itemsPerPage,
  filteredData,
  allPreDraftTeams,
  availableYears,
  availableAges,
  availableNationalities,
  loading,
  loadAllTeamData
} = useDraftData()

// Sync filters with URL query strings
useFilterUrlSync({
  selectedTeam,
  selectedYear,
  yearRange,
  useYearRange,
  selectedRounds,
  overallPickRange,
  preDraftTeamSearch,
  selectedPositions,
  ageRange,
  tradeFilter,
  selectedNationalities,
  sortBy,
  currentPage,
  itemsPerPage
})

const showPlayerMeasurements = ref(false)

async function loadData() {
  try {
    const response = await fetch(getDataUrl('teams.json'))
    if (!response.ok) {
      console.error('Failed to fetch teams.json:', response.status)
      return
    }
    const teams = await response.json() as TeamAbbreviation[]
    await loadAllTeamData(teams)
  } catch (err) {
    console.error('Error in loadData:', err)
  }
}

onMounted(() => {
  loadData()
  loadCountryData()
})
</script>

<template>
  <v-app>
    <SplashScreen v-if="showSplash" @continue="markSplashSeen" />

    <!-- <v-app-bar elevation="2" color="primary">
      <v-app-bar-title class="font-weight-bold">
        Real Draft History
      </v-app-bar-title>

      <v-spacer />

      <ThemeToggle />
    </v-app-bar> -->

    <v-main>
      <v-container fluid class="table-container">
        <v-row>
          <v-col cols="12">
            <DraftTable
              :data="filteredData"
              :loading="loading"
              v-model:selected-team="selectedTeam"
              v-model:year-range="yearRange"
              v-model:selected-year="selectedYear"
              v-model:use-year-range="useYearRange"
              v-model:selected-rounds="selectedRounds"
              v-model:overall-pick-range="overallPickRange"
              v-model:pre-draft-team-search="preDraftTeamSearch"
              v-model:selected-positions="selectedPositions"
              v-model:age-range="ageRange"
              v-model:trade-filter="tradeFilter"
              v-model:selected-nationalities="selectedNationalities"
              v-model:sort-by="sortBy"
              v-model:current-page="currentPage"
              v-model:items-per-page="itemsPerPage"
              v-model:show-player-measurements="showPlayerMeasurements"
              :available-years="availableYears"
              :all-pre-draft-teams="allPreDraftTeams"
              :available-ages="availableAges"
              :available-nationalities="availableNationalities"
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

.table-container {
  padding: 16px 8px 0 !important;
  max-width: 100%;
}

@media (min-width: 600px) {
  .table-container {
    padding: 20px 16px 0 !important;
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
