<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <v-btn
    :icon="isDark ? 'mdi-white-balance-sunny' : 'mdi-weather-night'"
    color="on-surface-variant"
    variant="text"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggleTheme"
  />
</template>
