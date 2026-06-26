import { ref, watch, onMounted } from 'vue'
import { useTheme as useVuetifyTheme } from 'vuetify'

const THEME_STORAGE_KEY = 'nba-draft-theme'

export function useTheme() {
  const vuetifyTheme = useVuetifyTheme()
  const isDark = ref(true)

  function loadThemePreference(): boolean {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null) {
      return stored === 'dark'
    }
    // Courtside is dark-first: default to dark when the visitor has no saved choice.
    return true
  }

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  watch(isDark, (newValue) => {
    vuetifyTheme.global.name.value = newValue ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, newValue ? 'dark' : 'light')
  })

  onMounted(() => {
    const preferred = loadThemePreference()
    isDark.value = preferred
    // Sync Vuetify explicitly: when the stored preference matches the initial ref the
    // watcher won't fire, so the theme name must be set here to stay consistent.
    vuetifyTheme.global.name.value = preferred ? 'dark' : 'light'
  })

  return {
    isDark,
    toggleTheme
  }
}
