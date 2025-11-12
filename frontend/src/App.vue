<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SplashScreen from './components/SplashScreen.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import DraftTable from './components/DraftTable.vue'
import AppFooter from './components/AppFooter.vue'
import { useSplashScreen } from './composables/useSplashScreen'
import { useDraftData } from './composables/useDraftData'
import type { TeamAbbreviation } from './types/team'

const { showSplash, markSplashSeen } = useSplashScreen()
const {
  selectedTeam,
  yearRange,
  selectedRounds,
  overallPickRange,
  preDraftTeamSearch,
  tradeFilter,
  filteredData,
  allPreDraftTeams,
  loading,
  loadAllTeamData
} = useDraftData()

const availableYears = computed(() => {
  const years = new Set<number>()
  filteredData.value.forEach(pick => years.add(pick.year))
  return Array.from(years)
})

async function loadData() {
  try {
    const response = await fetch('/data/teams.json')
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
              v-model:selected-rounds="selectedRounds"
              v-model:overall-pick-range="overallPickRange"
              v-model:pre-draft-team-search="preDraftTeamSearch"
              v-model:trade-filter="tradeFilter"
              :available-years="availableYears"
              :all-pre-draft-teams="allPreDraftTeams"
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
  padding: 2.5vw 10vw 0 !important;
  max-width: 100%;
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
