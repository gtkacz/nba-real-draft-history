<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useDataVersion } from '@/composables/useDataVersion'

const display = useDisplay()
const isMobile = computed(() => display.mobile.value)

const currentYear = computed(() => new Date().getFullYear())
const copyrightYears = computed(() => {
  const startYear = 2025
  return startYear === currentYear.value ? startYear : `${startYear}-${currentYear.value}`
})

// Get app version from package.json (injected by Vite)
const appVersion = computed(() => {
  // @ts-expect-error - __APP_VERSION__ is injected by Vite at build time
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'
})

const { dataVersion, loadDataVersion } = useDataVersion()
onMounted(loadDataVersion)
</script>

<template>
  <v-footer class="app-footer" color="background">
    <v-container>
      <v-row align="center" justify="center">
        <v-col class="text-center">
          <div :class="isMobile ? 'text-body-1' : 'text-body-2'">
            <a
              href="https://github.com/gtkacz/nba-real-draft-history/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              class="copyright-link"
            >
              &copy; {{ copyrightYears }} Gabriel Mitelman Tkacz. All rights reserved.
            </a>
          </div>
          <div :class="isMobile ? 'text-body-1' : 'text-body-2'" class="mt-2">
            Data sourced from
            <a
              href="https://basketball.realgm.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-decoration-none realgm-link"
            >
              <img
                src="https://basketball.realgm.com/images/icons/realgm-black-80-alt.png"
                alt="RealGM"
                class="realgm-logo"
              />
              <span>RealGM</span>
            </a>
            and
            <a
              href="https://www.nba.com/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-decoration-none nba-link"
            >
              <img
                src="https://cdn.nba.com/logos/leagues/L/logo-nba-logoman.svg"
                alt="NBA.com"
                class="nba-logo"
              />
              <span>NBA.com</span>
            </a>
            and used under fair use.
            <p :class="isMobile ? 'text-body-2' : 'text-caption'" class="app-version mt-2">
              v{{ appVersion }}.{{ dataVersion }}
            </p>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-footer>
</template>

<style scoped lang="scss">
.app-footer {
  margin-top: auto;

  :deep(*) {
    opacity: .8;
  }

  .app-version {
    color: rgb(var(--v-theme-on-surface-variant));
    opacity: 1;
  }

  a {
    color: #F16D20;
    transition: opacity 0.2s;
    opacity: 1 !important;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    margin: -4px -8px;

    &:hover {
      opacity: 0.9;
    }
  }

  .copyright-link {
    color: inherit;
    text-decoration: none;
    display: inline;
    min-height: auto;
    padding: 0;
    margin: 0;

    &:hover {
      opacity: 0.8;
    }
  }

  .realgm-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    vertical-align: middle;
    min-height: 44px;
    padding: 4px 8px;
    margin: -4px -8px;
  }

  .realgm-logo {
    display: inline-block;
    height: 1em;
    width: auto;
    vertical-align: middle;
    object-fit: contain;
  }

  .nba-link {
    color: #253B73 !important;
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    vertical-align: middle;
    min-height: 44px;
    padding: 4px 8px;
    margin: -4px -8px;
  }

  .nba-logo {
    display: inline-block;
    height: 1.25em;
    width: auto;
    vertical-align: middle;
    object-fit: contain;
  }

  @media (max-width: 959px) {
    .app-footer {
      padding: 16px 8px !important;
    }
  }
}
</style>
