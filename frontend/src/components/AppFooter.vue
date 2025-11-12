<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
const copyrightYears = computed(() => {
  const startYear = 2025
  return startYear === currentYear.value ? startYear : `${startYear}-${currentYear.value}`
})
</script>

<template>
  <v-footer class="app-footer" color="transparent">
    <v-container>
      <v-row align="center" justify="center">
        <v-col class="text-center">
          <div class="text-body-2">
            &copy; {{ copyrightYears }} Gabriel Mitelman Tkacz. All rights reserved.
          </div>
          <div class="text-body-2">
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
            and used under fair use.
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

  a {
    color: #F16D20;
    transition: opacity 0.2s;
    opacity: 1 !important;

    &:hover {
      opacity: 0.9;
    }
  }

  .realgm-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    vertical-align: middle;
  }

  .realgm-logo {
    display: inline-block;
    height: 1em;
    width: auto;
    vertical-align: middle;
    object-fit: contain;
  }
}
</style>
