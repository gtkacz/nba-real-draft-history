// Import Vuetify styles
import 'vuetify/styles'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases } from 'vuetify/iconsets/mdi-svg'
import { mdiSvgStringSet } from './icons'

const nbaRed = '#C8102E'
const nbaBlue = '#1D428A'

const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    primary: nbaBlue,
    secondary: nbaRed,
    background: '#FFFFFF',
    surface: '#F5F5F5',
    'on-background': '#000000',
    'on-surface': '#000000',
    error: '#B00020',
    info: nbaBlue,
    success: '#4CAF50',
    warning: '#FB8C00'
  }
}

const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    primary: nbaBlue,
    secondary: nbaRed,
    background: '#121212',
    surface: '#1E1E1E',
    'on-background': '#FFFFFF',
    'on-surface': '#FFFFFF',
    error: '#CF6679',
    info: nbaBlue,
    success: '#4CAF50',
    warning: '#FB8C00'
  }
}

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi: mdiSvgStringSet }
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: lightTheme,
      dark: darkTheme
    }
  },
  defaults: {
    VBtn: {
      color: 'primary',
      variant: 'elevated'
    },
    VCard: {
      elevation: 2
    }
  }
})
