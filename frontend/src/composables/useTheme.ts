import { ref, watch, onMounted } from 'vue'
import { useTheme as useVuetifyTheme } from 'vuetify'

const THEME_STORAGE_KEY = 'nba-draft-theme'

export function useTheme() {
  const vuetifyTheme = useVuetifyTheme()
  const isDark = ref(false)

  function detectBrowserPreference(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function loadThemePreference(): boolean {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      return stored === 'dark'
    }
    return detectBrowserPreference()
  }

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  watch(isDark, (newValue) => {
    vuetifyTheme.global.name.value = newValue ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, newValue ? 'dark' : 'light')
  })

  onMounted(() => {
    // isDark.value = loadThemePreference()
    isDark.value = false
  })

  return {
    isDark,
    toggleTheme
  }
}
