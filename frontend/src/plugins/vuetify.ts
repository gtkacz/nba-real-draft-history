// Import Vuetify styles
import 'vuetify/styles'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { mdiSvgStringSet } from './icons'

// Courtside: NBA red is the single sharp accent; blue is demoted to secondary/brand.
const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    primary: '#C8102E',
    secondary: '#1D428A',
    background: '#F6F7F9',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-variant': '#F0F2F5',
    'on-surface-variant': '#5B6573',
    'on-background': '#0F1626',
    'on-surface': '#0F1626',
    error: '#C8102E',
    info: '#1D428A',
    success: '#1E9E6A',
    warning: '#C9761B',
    brand: '#f06931',
  }
}

const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    // Red brightened from brand #C8102E for AA contrast on near-black surfaces.
    primary: '#E63E54',
    secondary: '#4C7DEE',
    background: '#0B0F17',
    surface: '#12161F',
    'surface-bright': '#171C26',
    'surface-variant': '#1C2230',
    'on-surface-variant': '#A4ADBC',
    'on-background': '#E6E8EB',
    'on-surface': '#E6E8EB',
    error: '#FF5C73',
    info: '#4C7DEE',
    success: '#34C98A',
    warning: '#F0A93C',
    brand: '#f06931',
  }
}

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi: mdiSvgStringSet }
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      light: lightTheme,
      dark: darkTheme
    }
  },
  defaults: {
    VBtn: {
      color: 'primary',
      variant: 'flat',
      rounded: 'lg'
    },
    VCard: {
      elevation: 0,
      rounded: 'lg'
    },
    VTextField: {
      variant: 'outlined',
      rounded: 'lg'
    },
    VAutocomplete: {
      variant: 'outlined',
      rounded: 'lg'
    },
    VSelect: {
      variant: 'outlined',
      rounded: 'lg'
    },
    VCombobox: {
      variant: 'outlined',
      rounded: 'lg'
    },
    VChip: {
      rounded: 'md'
    }
  }
})
