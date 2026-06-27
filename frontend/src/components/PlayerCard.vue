<script setup lang="ts">
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import type { DraftPick } from '@/types/draft'
import { getCanonicalTeam, getDisplayTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { useTeamData } from '@/composables/useTeamData'
import { useCountryData } from '@/composables/useCountryData'
import { getPlayerStatus } from '@/utils/playerStatus'

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
const { getFormattedCountryName } = useCountryData()

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

// Format award names for display (keeping NBA prefix)
function formatAwardName(award: string): string {
  return award
}

// A rookie is an active player who has not yet completed an NBA season. Purely
// visual; rookies still count as active players for filtering.
function isRookie(pick: DraftPick): boolean {
  return getPlayerStatus(pick) === 'active' && pick.yearsOfService === 0
}

function getRetirementText(pick: DraftPick): string {
  const status = getPlayerStatus(pick)
  const playedUntilYear = pick.played_until_year ?? undefined
  const playsFor = pick.plays_for
  if (status === 'never-debuted') return 'Never debuted in the NBA'
  if (status === 'active') {
    if (playsFor && playsFor.trim() !== '') {
      return `Currently plays for the ${getTeamDisplayName(playsFor, playedUntilYear)}`
    }
    return 'Currently active'
  } else if (status === 'retired') {
    if (playsFor && playsFor.trim() !== '') {
      return `Last played for ${getTeamDisplayName(playsFor, playedUntilYear)} in ${playedUntilYear}`
    }
    return `Retired in ${playedUntilYear}`
  } else {
    return 'Status unknown'
  }
}

// Mirrors MobileDraftCard's parseTradeChain helper; computed once to avoid repeated parsing in template
const tradeChain = computed<string[]>(() => {
  const player = props.player
  if (!player?.draftTrades || player.draftTrades.trim() === '') return []

  const parts = player.draftTrades.split(/\s+to\s+/).map(p => p.trim()).filter(p => p)
  if (parts.length < 2) return []

  const displayTeams: string[] = []
  const canonicalTeams: string[] = []

  const firstTeam = parts[0]?.trim()
  if (firstTeam) {
    displayTeams.push(getDisplayTeam(firstTeam, player.year))
    canonicalTeams.push(getCanonicalTeam(firstTeam, player.year))
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    const team = part.split(/\s+/)[0]
    if (team && team.length <= 4) {
      displayTeams.push(getDisplayTeam(team, player.year))
      canonicalTeams.push(getCanonicalTeam(team, player.year))
    }
  }

  const unifiedDisplayTeams: string[] = []
  const seenCanonical: string[] = []

  for (let i = 0; i < displayTeams.length; i++) {
    const displayTeam = displayTeams[i]
    const canonical = canonicalTeams[i]
    if (!displayTeam || !canonical) continue

    if (seenCanonical.length === 0 || seenCanonical[seenCanonical.length - 1] !== canonical) {
      unifiedDisplayTeams.push(displayTeam)
      seenCanonical.push(canonical)
    }
  }

  return unifiedDisplayTeams.length >= 2 ? unifiedDisplayTeams : []
})
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
        <div class="player-card-info pa-10">
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

          <v-divider class="my-3" />

          <!-- Nationality -->
          <div v-if="player.origin_country" class="detail-item mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Nationality</div>
            <div class="d-flex align-center gap-2">
              <span
                :class="`fi fi-${getCountryCode(player.origin_country)}`"
                class="player-flag-icon"
              />
              <span class="text-body-1 font-weight-medium">
                {{ getFormattedCountryName(player.origin_country) }}
              </span>
            </div>
          </div>

          <!-- Years in the League -->
          <div class="detail-item mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Years in the League</div>
            <div class="text-body-1 font-weight-medium">
              {{ player.yearsOfService !== undefined ? player.yearsOfService : 'N/A' }}
            </div>
          </div>

          <!-- Retirement / Current Team Status -->
          <div
            v-if="getPlayerStatus(player) !== 'unknown'"
            class="detail-item mb-3"
          >
            <div class="text-caption text-medium-emphasis mb-1 d-flex align-center gap-1">
              <template v-if="isRookie(player)">
                <v-icon icon="mdi-account-plus" size="16" color="primary" />
                <span>Rookie · Currently Plays For</span>
              </template>
              <template v-else-if="getPlayerStatus(player) === 'never-debuted'">
                <v-icon icon="mdi-account-clock" size="16" color="info" />
                <span>NBA Status</span>
              </template>
              <template v-else>
                {{ getPlayerStatus(player) === 'retired' ? 'Retired — Last Played For' : 'Currently Plays For' }}
              </template>
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ getRetirementText(player) }}
            </div>
          </div>

          <!-- Trade Chain -->
          <div v-if="tradeChain.length > 0" class="detail-item mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Pick Trades</div>
            <div class="trade-chain">
              <template v-for="(team, index) in tradeChain" :key="index">
                <v-avatar size="24" class="mr-1" rounded="0" style="background: transparent;">
                  <v-img
                    :src="getTeamLogoUrl(team, player.year)"
                    :alt="getTeamDisplayName(team, player.year)"
                    contain
                  />
                </v-avatar>
                <span v-if="index < tradeChain.length - 1" class="mx-1 text-medium-emphasis">→</span>
              </template>
            </div>
          </div>

          <!-- Awards (full list) -->
          <div v-if="player.awards && Object.keys(player.awards).length > 0" class="detail-item mb-3">
            <div class="text-caption text-medium-emphasis mb-1 d-flex align-center">
              <v-icon icon="mdi-star" size="16" color="warning" class="mr-1" />
              Awards
            </div>
            <ul class="text-body-1 font-weight-medium" style="margin: 0; padding-left: 20px;">
              <li v-for="(times, awardName) in player.awards" :key="awardName">
                {{ formatAwardName(awardName) }} ({{ times }} {{ times === 1 ? 'time' : 'times' }})
              </li>
            </ul>
          </div>

          <!-- Outbound Links -->
          <div v-if="player.nba_id" class="detail-item">
            <div class="text-caption text-medium-emphasis mb-1">External Links</div>
            <div class="d-flex gap-2">
              <v-btn
                :href="`https://www.nba.com/stats/player/${player.nba_id}`"
                target="_blank"
                rel="noopener noreferrer"
                variant="tonal"
                size="small"
                prepend-icon="mdi-open-in-new"
                color="primary"
              >
                NBA Stats
              </v-btn>
            </div>
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

  .player-flag-icon {
    display: inline-block;
    width: 20px;
    height: 15px;
    border-radius: 2px;
    vertical-align: middle;
    flex-shrink: 0;
  }

  .trade-chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
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
