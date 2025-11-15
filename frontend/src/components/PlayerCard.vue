<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import type { DraftPick } from '@/types/draft'
import { getCanonicalTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { useTeamData } from '@/composables/useTeamData'

const display = useDisplay()
const isMobile = computed(() => display.mobile.value)

interface PlayerCardProps {
  player: DraftPick | null
  modelValue: boolean
}

const props = defineProps<PlayerCardProps>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

function getPlayerHeadshotUrl(nbaId: string | number | undefined): string {
  if (!nbaId) return ''
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`
}

const { getTeamFullName } = useTeamData()

const teamCode = computed(() => {
  if (!props.player) return ''
  return getCanonicalTeam(props.player.team, props.player.year)
})

function getTeamDisplayName(team: string | null | undefined, year?: number): string {
  if (!team) return 'Unknown'
  const originalTeam = getOriginalTeamName(team, year)
  return getTeamFullName(originalTeam)
}

function getTeamLogoUrl(team: string, year?: number): string {
  const canonicalTeam = getCanonicalTeam(team, year)
  return `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${canonicalTeam.toLowerCase()}.svg`
}

const teamLogoUrl = computed(() => {
  if (!props.player) return ''
  return getTeamLogoUrl(props.player.team, props.player.year)
})

// Get team CSS variables - will be provided by user
const teamColorPrimary = computed(() => {
  if (!props.player) return 'var(--team-default-primary, #1D428A)'
  return `var(--team-${teamCode.value.toLowerCase()}-primary, #1D428A)`
})

const teamColorSecondary = computed(() => {
  if (!props.player) return 'var(--team-default-secondary, #C8102E)'
  return `var(--team-${teamCode.value.toLowerCase()}-secondary, #C8102E)`
})

const teamColorAccent = computed(() => {
  if (!props.player) return 'var(--team-default-accent, #FFFFFF)'
  return `var(--team-${teamCode.value.toLowerCase()}-accent, #FFFFFF)`
})

// Remove "NBA" prefix from award names for display
function formatAwardName(award: string): string {
  return award.replace(/^NBA\s+/i, '').trim()
}
</script>

<template>
  <v-dialog
    v-model="isOpen"
    :max-width="isMobile ? undefined : '500'"
    :fullscreen="isMobile"
    scrollable
  >
    <v-card
      v-if="player"
      class="player-card"
      rounded="lg"
      :style="{
        '--team-primary': teamColorPrimary,
        '--team-secondary': teamColorSecondary,
        '--team-accent': teamColorAccent
      }"
    >
      <v-card-title class="player-card-header d-flex align-center justify-space-between">
          <div class="d-flex align-center">
          <div class="team-logo-container mr-2">
            <v-img
              :src="teamLogoUrl"
              :alt="getTeamDisplayName(player.team, player.year)"
              contain
              class="team-logo-img"
            />
          </div>
          <div>
            <div class="d-flex align-center flex-wrap gap-1">
              <span class="text-h6 font-weight-bold">{{ player.player }}</span>
              <!-- Awards Star Icon -->
              <v-tooltip v-if="player.awards && Object.keys(player.awards).length > 0" location="top">
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
                    <li v-for="(times, awardName) in player.awards" :key="awardName">
                      {{ formatAwardName(awardName) }} ({{ times }} {{ times === 1 ? 'time' : 'times' }})
                    </li>
                  </ul>
                </div>
              </v-tooltip>
            </div>
            <div class="text-caption text-medium-emphasis">{{ getTeamDisplayName(player.team, player.year) }} • {{ player.year }}</div>
          </div>
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="default"
          @click="isOpen = false"
          min-width="44"
          min-height="44"
        />
      </v-card-title>

      <v-card-text class="player-card-content pa-0">
        <!-- Player Image -->
        <div class="player-card-image-container">
          <v-img
            v-if="player.nba_id"
            :src="getPlayerHeadshotUrl(player.nba_id)"
            :alt="player.player"
            contain
            class="player-card-image"
            height="150"
          >
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="60" color="grey-lighten-1" />
              </div>
            </template>
            <template #error>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="60" color="grey-lighten-1" />
              </div>
            </template>
          </v-img>
          <v-img
            v-else
            :src="getPlayerHeadshotUrl(202382)"
            :alt="player.player"
            contain
            class="player-card-image"
            height="150"
          >
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="60" color="grey-lighten-1" />
              </div>
            </template>
            <template #error>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="60" color="grey-lighten-1" />
              </div>
            </template>
          </v-img>
        </div>

        <!-- Player Info -->
        <div class="player-card-info pa-4">
          <div class="player-measurements mb-3">
            <div class="text-h6 mb-2 font-weight-bold">Measurements</div>
            <v-row dense>
              <v-col cols="6">
                <div class="measurement-item">
                  <div class="text-caption text-medium-emphasis mb-1">Height</div>
                  <div class="text-h6 font-weight-bold">{{ player.height || 'N/A' }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="measurement-item">
                  <div class="text-caption text-medium-emphasis mb-1">Weight</div>
                  <div class="text-h6 font-weight-bold">
                    {{ player.weight ? `${player.weight} lbs` : 'N/A' }}
                  </div>
                </div>
              </v-col>
            </v-row>
          </div>

          <v-divider class="mb-3" />

          <div class="player-details">
            <v-row dense>
              <v-col cols="6">
                <div class="detail-item mb-2">
                  <div class="text-caption text-medium-emphasis mb-1">Position</div>
                  <div class="text-body-1 font-weight-medium">{{ player.position || 'N/A' }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item mb-2">
                  <div class="text-caption text-medium-emphasis mb-1">Draft Age</div>
                  <div class="text-body-1 font-weight-medium">{{ player.age || 'N/A' }}</div>
                </div>
              </v-col>
              <v-col cols="12">
                <div class="detail-item mb-2">
                  <div class="text-caption text-medium-emphasis mb-1">Drafted From</div>
                  <div class="text-body-1 font-weight-medium">{{ player.preDraftTeam || 'N/A' }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="text-caption text-medium-emphasis mb-1">Round</div>
                  <div class="text-body-1 font-weight-medium">{{ player.round }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="text-caption text-medium-emphasis mb-1">Pick</div>
                  <div class="text-body-1 font-weight-medium">{{ player.pick }}</div>
                </div>
              </v-col>
            </v-row>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.player-card {
  overflow: hidden;
  // border-radius: 16px;

  .player-card-header {
    background: linear-gradient(135deg, var(--team-primary) 0%, var(--team-secondary) 100%);
    color: var(--team-accent);
    padding: 12px 16px;

    :deep(.v-btn) {
      color: var(--team-accent);
    }

    .team-logo-container {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border-radius: 0;
      overflow: visible;

      .team-logo-img {
        width: 100%;
        height: 100%;
        max-width: 40px;
        max-height: 40px;
      }

      :deep(.v-img) {
        width: 100%;
        height: 100%;
      }

      :deep(.v-img__img) {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
      }

      :deep(.v-img__wrapper) {
        width: 100%;
        height: 100%;
      }

      :deep(.v-img__sizer) {
        padding-bottom: 0 !important;
      }
    }
  }

  .player-card-content {
    background: rgba(var(--v-theme-surface), 1);
  }

  .player-card-image-container {
    position: relative;
    width: 100%;
    overflow: hidden;
    background: linear-gradient(135deg, var(--team-primary) 0%, var(--team-secondary) 100%);

    .player-card-image {
      width: 100%;
      object-fit: contain;
    }

    .player-card-image-placeholder {
      height: 150px;
      background: linear-gradient(135deg, var(--team-primary) 0%, var(--team-secondary) 100%);
    }
  }

  .player-card-info {
    background: rgba(var(--v-theme-surface), 1);
  }

  .measurement-item,
  .detail-item {
    padding: 4px 0;
  }

  // Team color theming
  :deep(.v-divider) {
    border-color: rgba(var(--v-theme-on-surface), 0.12);
  }
}

// Dark mode adjustments
.v-theme--dark {
  .player-card {
    .player-card-info {
      background: rgba(var(--v-theme-surface), 1);
    }
  }
}
</style>

