<script setup lang="ts">
import { ref } from 'vue'
import type { DraftPick } from '@/types/draft'
import { getCanonicalTeam, getDisplayTeam, getOriginalTeamName } from '@/utils/teamAliases'
import { getCountryCode } from '@/utils/countryCodeConverter'
import { useTeamData } from '@/composables/useTeamData'

interface MobileDraftCardProps {
  item: DraftPick
  showPlayerMeasurements?: boolean
}

const props = defineProps<MobileDraftCardProps>()

const { getTeamFullName } = useTeamData()

const expanded = ref(false)

function getTeamLogoUrl(team: string, year?: number): string {
  const canonicalTeam = getCanonicalTeam(team, year)
  return `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${canonicalTeam.toLowerCase()}.svg`
}

function getPlayerHeadshotUrl(nbaId: string | number | undefined): string {
  if (!nbaId) return ''
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`
}

function getOriginalTeam(trades: string | null, year?: number): string | null {
  if (!trades || trades.trim() === '') return null
  const firstToIndex = trades.indexOf(' to ')
  if (firstToIndex === -1) return null
  const original = trades.substring(0, firstToIndex).trim()
  if (!original) return null
  return getDisplayTeam(original, year)
}

function getTeamDisplayName(team: string | null | undefined, year?: number): string {
  if (!team) return 'Unknown'
  const originalTeam = getOriginalTeamName(team, year)
  return getTeamFullName(originalTeam)
}

function isDifferentTeam(originalTeam: string | null, currentTeam: string, year?: number): boolean {
  if (!originalTeam) return false
  return getCanonicalTeam(originalTeam, year) !== getCanonicalTeam(currentTeam, year)
}

function parseTradeChain(trades: string | null, year?: number): string[] {
  if (!trades || trades.trim() === '') return []
  const parts = trades.split(/\s+to\s+/).map(p => p.trim()).filter(p => p)
  if (parts.length < 2) return []
  
  const displayTeams: string[] = []
  const canonicalTeams: string[] = []
  
  const firstTeam = parts[0]?.trim()
  if (firstTeam) {
    displayTeams.push(getDisplayTeam(firstTeam, year))
    canonicalTeams.push(getCanonicalTeam(firstTeam, year))
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    const team = part.split(/\s+/)[0]
    if (team && team.length <= 4) {
      displayTeams.push(getDisplayTeam(team, year))
      canonicalTeams.push(getCanonicalTeam(team, year))
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
}

function splitPosition(position: string): string[] {
  if (!position || position.trim() === '') return []
  position = position.replace(/^[SP]/g, '')
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

function getPlayerRetirementStatus(playedUntilYear: number | undefined): 'active' | 'retired' | 'unknown' {
  if (playedUntilYear === undefined) return 'unknown'
  const currentYear = new Date().getFullYear()
  return playedUntilYear < currentYear ? 'retired' : 'active'
}

function getRetirementText(playedUntilYear: number | undefined, playsFor: string | undefined, year?: number): string {
  const status = getPlayerRetirementStatus(playedUntilYear)
  if (status === 'active') {
    if (playsFor && playsFor.trim() !== '') {
      return `Currently plays for ${getTeamDisplayName(playsFor, year)}`
    }
    return 'Currently active'
  } else if (status === 'retired') {
    if (playsFor && playsFor.trim() !== '') {
      return `Last played for ${getTeamDisplayName(playsFor, year)} in ${playedUntilYear}`
    }
    return `Retired in ${playedUntilYear}`
  } else {
    return 'Status unknown'
  }
}

const emit = defineEmits<{
  playerClick: [player: DraftPick]
}>()

function handlePlayerClick() {
  if (props.item.nba_id) {
    emit('playerClick', props.item)
  }
}
</script>

<template>
  <v-card
    class="mobile-draft-card mb-3"
    elevation="2"
    @click="expanded = !expanded"
  >
    <v-card-text class="pa-4">
      <!-- Header: Player Info -->
      <div class="d-flex align-center mb-3">
          <v-avatar 
          :size="56" 
          class="mr-3 player-headshot"
          :class="{ 'player-headshot-clickable': item.nba_id }"
          color="grey-lighten-4"
          @click.stop="handlePlayerClick"
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
                <v-icon icon="mdi-account" size="32" color="grey-lighten-1" />
              </div>
            </template>
            <template #error>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="32" color="grey-lighten-1" />
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
                <v-icon icon="mdi-account" size="32" color="grey-lighten-1" />
              </div>
            </template>
            <template #error>
              <div class="d-flex align-center justify-center fill-height">
                <v-icon icon="mdi-account" size="32" color="grey-lighten-1" />
              </div>
            </template>
          </v-img>
        </v-avatar>
        
        <div class="flex-grow-1">
          <div class="d-flex align-center flex-wrap gap-1 mb-1">
            <span class="text-h6 font-weight-bold text-primary">
              {{ item.player }}
              <v-icon
                v-if="item.is_defunct === 1"
                icon="mdi-cross"
                title="Deceased"
                size="16"
                color="error"
                class="ml-1"
              />
            </span>
            <span
              :class="`fi fi-${getCountryCode(item.origin_country)}`"
              class="player-flag-icon"
            />
            <template v-if="getPlayerRetirementStatus(item.played_until_year) === 'active' && item.plays_for && getCanonicalTeam(item.plays_for, item.year) !== getCanonicalTeam(item.team, item.year)">
              <v-avatar
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
              v-else-if="getPlayerRetirementStatus(item.played_until_year) === 'retired'"
              icon="mdi-account-off"
              size="16"
              color="grey"
            />
            <v-icon
              v-else-if="getPlayerRetirementStatus(item.played_until_year) === 'active'"
              icon="mdi-account-check"
              size="16"
              color="success"
            />
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ getTeamDisplayName(item.team, item.year) }} • {{ item.year }}
            <template v-if="showPlayerMeasurements && (item.height || item.weight)">
              <span class="ml-1">• {{ item.height || 'N/A' }}</span>
              <template v-if="item.weight">
                <span class="ml-1">• {{ item.weight }} lbs</span>
              </template>
            </template>
          </div>
        </div>
        
        <v-btn
          :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          size="small"
          color="primary"
          variant="text"
          min-width="44"
          min-height="44"
        />
      </div>

      <!-- Quick Stats Row -->
      <div class="d-flex align-center justify-space-between mb-3">
        <div class="d-flex align-center gap-2">
          <v-chip size="small" color="primary" variant="tonal">
            Pick #{{ item.pick }}
          </v-chip>
          <v-chip size="small" color="secondary" variant="tonal">
            Round {{ item.round }}
          </v-chip>
          <div v-if="item.position" class="d-flex gap-1">
            <v-chip
              v-for="(pos, index) in splitPosition(item.position)"
              :key="index"
              size="small"
              variant="tonal"
              :color="getPositionColor(pos)"
            >
              {{ pos }}
            </v-chip>
          </div>
        </div>
      </div>

      <!-- Expanded Details -->
      <v-expand-transition>
        <div v-if="expanded">
          <v-divider class="mb-3" />
          
          <!-- Team Info -->
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Team</div>
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
          </div>

          <!-- Trade Chain -->
          <div v-if="item.draftTrades" class="mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Pick Trades</div>
            <div class="trade-chain">
              <template v-for="(team, index) in parseTradeChain(item.draftTrades, item.year)" :key="index">
                <v-avatar size="24" class="mr-1" rounded="0" style="background: transparent;">
                  <v-img
                    :src="getTeamLogoUrl(team, item.year)"
                    :alt="getTeamDisplayName(team, item.year)"
                    contain
                  />
                </v-avatar>
                <span v-if="index < parseTradeChain(item.draftTrades, item.year).length - 1" class="mx-1 text-medium-emphasis">→</span>
              </template>
            </div>
          </div>

          <!-- Player Measurements (Always shown in expanded view) -->
          <div class="mb-3">
            <div class="text-caption text-medium-emphasis mb-1">Measurements</div>
            <v-row dense>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="text-caption text-medium-emphasis mb-1">Height</div>
                  <div class="text-body-1 font-weight-medium">{{ item.height || 'N/A' }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="text-caption text-medium-emphasis mb-1">Weight</div>
                  <div class="text-body-1 font-weight-medium">
                    {{ item.weight ? `${item.weight} lbs` : 'N/A' }}
                  </div>
                </div>
              </v-col>
            </v-row>
          </div>

          <!-- Retirement/Current Team Status -->
          <div v-if="item.played_until_year !== undefined || item.plays_for" class="mb-3">
            <div class="text-caption text-medium-emphasis mb-1">
              {{ getPlayerRetirementStatus(item.played_until_year) === 'retired' ? 'Retired - Last Played For' : 'Currently Plays For' }}
            </div>
            <div class="text-body-1 font-weight-medium">
              {{ getRetirementText(item.played_until_year, item.plays_for, item.year) }}
            </div>
          </div>

          <!-- Additional Details Grid -->
          <v-row dense>
            <v-col cols="6">
              <div class="detail-item">
                <div class="text-caption text-medium-emphasis mb-1">Draft Age</div>
                <div class="text-body-1 font-weight-medium">{{ item.age || 'N/A' }}</div>
              </div>
            </v-col>
            <v-col cols="12">
              <div class="detail-item">
                <div class="text-caption text-medium-emphasis mb-1">Drafted From</div>
                <div class="text-body-1 font-weight-medium">{{ item.preDraftTeam || 'N/A' }}</div>
              </div>
            </v-col>
          </v-row>
        </div>
      </v-expand-transition>
    </v-card-text>
  </v-card>
</template>

<style scoped lang="scss">
.mobile-draft-card {
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
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

  .player-status-icon {
    margin-left: 4px;
    flex-shrink: 0;
  }

  .player-flag-icon {
    display: inline-block;
    width: 20px;
    height: 15px;
    border-radius: 2px;
    vertical-align: middle;
  }

  .trade-chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .detail-item {
    padding: 4px 0;
  }
}
</style>


