// Tree-shaken MDI icon set.
//
// The app references icons by their string name (e.g. icon="mdi-download"). The
// default @mdi/font webfont ships every icon (hundreds of KB) regardless of how
// few are used. This module instead imports only the icons actually used from
// @mdi/js (each is a single SVG path string) and exposes a custom Vuetify icon
// set that resolves those string names to their path. This keeps every existing
// `icon="mdi-*"` usage working unchanged while bundling only the icons below.

import { defineComponent, h, mergeProps, type Component, type PropType } from 'vue'
import type { IconSet } from 'vuetify'
import {
  mdiAccount,
  mdiAccountCheck,
  mdiAccountClock,
  mdiAccountOff,
  mdiAccountQuestion,
  mdiAccountPlus,
  mdiArrowRight,
  mdiBasketball,
  mdiBasketballHoop,
  mdiCakeVariant,
  mdiCalendar,
  mdiCancel,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiChevronUp,
  mdiClockOutline,
  mdiClose,
  mdiDotsVertical,
  mdiDownload,
  mdiDrag,
  mdiEarth,
  mdiAccountFilter,
  mdiFlag,
  mdiGithub,
  mdiGraveStone,
  mdiHome,
  mdiHumanMaleHeight,
  mdiInformation,
  mdiInformationOutline,
  mdiLinkVariant,
  mdiMagnify,
  mdiMapMarker,
  mdiMedal,
  mdiNumeric,
  mdiOpenInNew,
  mdiRefresh,
  mdiRulerSquare,
  mdiScaleBathroom,
  mdiSchool,
  mdiShareVariant,
  mdiStar,
  mdiSwapHorizontal,
  mdiTrophy,
  mdiViewColumnOutline,
  mdiWeatherNight,
  mdiWhiteBalanceSunny,
  mdiWeightLifter,
} from '@mdi/js'

// Maps the string names used in templates to their SVG path data. Any new
// `icon="mdi-*"` usage added to the app must have a matching entry here.
const ICON_MAP: Record<string, string> = {
  'mdi-account': mdiAccount,
  'mdi-account-check': mdiAccountCheck,
  'mdi-account-clock': mdiAccountClock,
  'mdi-account-off': mdiAccountOff,
  'mdi-account-question': mdiAccountQuestion,
  'mdi-account-plus': mdiAccountPlus,
  'mdi-arrow-right': mdiArrowRight,
  'mdi-basketball': mdiBasketball,
  'mdi-basketball-hoop': mdiBasketballHoop,
  'mdi-cake-variant': mdiCakeVariant,
  'mdi-calendar': mdiCalendar,
  'mdi-cancel': mdiCancel,
  'mdi-chevron-down': mdiChevronDown,
  'mdi-chevron-left': mdiChevronLeft,
  'mdi-chevron-right': mdiChevronRight,
  'mdi-chevron-up': mdiChevronUp,
  'mdi-clock-outline': mdiClockOutline,
  'mdi-close': mdiClose,
  'mdi-dots-vertical': mdiDotsVertical,
  'mdi-download': mdiDownload,
  'mdi-drag': mdiDrag,
  'mdi-earth': mdiEarth,
  'mdi-account-filter': mdiAccountFilter,
  'mdi-flag': mdiFlag,
  'mdi-github': mdiGithub,
  'mdi-grave-stone': mdiGraveStone,
  'mdi-home': mdiHome,
  'mdi-human-male-height': mdiHumanMaleHeight,
  'mdi-information': mdiInformation,
  'mdi-information-outline': mdiInformationOutline,
  'mdi-link-variant': mdiLinkVariant,
  'mdi-magnify': mdiMagnify,
  'mdi-map-marker': mdiMapMarker,
  'mdi-medal': mdiMedal,
  'mdi-numeric': mdiNumeric,
  'mdi-open-in-new': mdiOpenInNew,
  'mdi-refresh': mdiRefresh,
  'mdi-ruler-square': mdiRulerSquare,
  'mdi-scale-bathroom': mdiScaleBathroom,
  'mdi-school': mdiSchool,
  'mdi-share-variant': mdiShareVariant,
  'mdi-star': mdiStar,
  'mdi-swap-horizontal': mdiSwapHorizontal,
  'mdi-trophy': mdiTrophy,
  'mdi-view-column-outline': mdiViewColumnOutline,
  'mdi-weather-night': mdiWeatherNight,
  'mdi-white-balance-sunny': mdiWhiteBalanceSunny,
  'mdi-weight-lifter': mdiWeightLifter,
}

// Mirrors Vuetify's built-in VSvgIcon: the svg must be wrapped in the icon `tag`
// element (which carries the .v-icon sizing context) with attrs forwarded.
// Rendering a bare <svg> drops that context and the icon expands to fill its
// container. The only addition here is resolving "mdi-*" names to their path.
const MdiStringIcon = defineComponent({
  name: 'MdiStringIcon',
  inheritAttrs: false,
  props: {
    icon: { type: [String, Array, Object, Function] as PropType<unknown> },
    tag: { type: [String, Object, Function] as PropType<string | Component>, required: true },
  },
  setup(props, { attrs }) {
    return () => {
      const raw = typeof props.icon === 'string' ? props.icon : ''
      const path = raw.startsWith('mdi-') ? (ICON_MAP[raw] ?? '') : raw
      return h(props.tag, mergeProps(attrs, { style: null }), {
        default: () => [
          h(
            'svg',
            {
              class: 'v-icon__svg',
              xmlns: 'http://www.w3.org/2000/svg',
              viewBox: '0 0 24 24',
              role: 'img',
              'aria-hidden': 'true',
            },
            [h('path', { d: path })],
          ),
        ],
      })
    }
  },
})

// Cast: MdiStringIcon mirrors Vuetify's VSvgIcon at runtime, but IconSet types the
// `tag` prop with Vuetify's non-exported JSXComponent helper, which our PropType
// cannot name.
export const mdiSvgStringSet = { component: MdiStringIcon } as unknown as IconSet

export { ICON_MAP }
