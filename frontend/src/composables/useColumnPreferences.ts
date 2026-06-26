import { computed, ref, watch } from 'vue'

export interface ColumnPreferencesOptions {
  storageKey: string
  // Canonical column order used as the baseline and reset target.
  defaultOrder: string[]
  // Default pixel width per column key.
  defaultWidths: Record<string, number>
  // Keys the user may individually hide via the columns menu.
  toggleableKeys: string[]
  // Keys that start hidden by default (still toggleable).
  defaultHidden?: string[]
  // Smallest width a column may be dragged to.
  minWidth?: number
}

interface PersistedState {
  order?: string[]
  visibility?: Record<string, boolean>
  widths?: Record<string, number>
}

/**
 * Reactive, localStorage-backed column layout preferences (order, visibility, width).
 *
 * Stored state is reconciled against the current column definitions on load so that
 * columns added or removed in a later release don't corrupt a returning user's layout.
 */
export function useColumnPreferences(options: ColumnPreferencesOptions) {
  const minWidth = options.minWidth ?? 60

  const hiddenByDefault = new Set(options.defaultHidden ?? [])

  function defaultVisibility(): Record<string, boolean> {
    return Object.fromEntries(options.toggleableKeys.map((key) => [key, !hiddenByDefault.has(key)]))
  }

  const order = ref<string[]>([...options.defaultOrder])
  const visibility = ref<Record<string, boolean>>(defaultVisibility())
  const widths = ref<Record<string, number>>({ ...options.defaultWidths })
  const hasCustomWidths = computed(() =>
    options.defaultOrder.some((key) => widths.value[key] !== options.defaultWidths[key]),
  )

  function load() {
    try {
      const raw = localStorage.getItem(options.storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as PersistedState

      if (Array.isArray(parsed.order)) {
        const known = new Set(options.defaultOrder)
        const kept = parsed.order.filter((key) => known.has(key))
        const missing = options.defaultOrder.filter((key) => !kept.includes(key))
        order.value = [...kept, ...missing]
      }

      if (parsed.visibility && typeof parsed.visibility === 'object') {
        for (const key of options.toggleableKeys) {
          if (typeof parsed.visibility[key] === 'boolean') {
            visibility.value[key] = parsed.visibility[key]
          }
        }
      }

      if (parsed.widths && typeof parsed.widths === 'object') {
        for (const key of options.defaultOrder) {
          const width = parsed.widths[key]
          if (typeof width === 'number' && width > 0) {
            widths.value[key] = Math.max(minWidth, Math.round(width))
          }
        }
      }
    } catch {
      // Corrupt or unavailable storage falls back to defaults.
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        options.storageKey,
        JSON.stringify({
          order: order.value,
          visibility: visibility.value,
          widths: widths.value,
        }),
      )
    } catch {
      // Ignore quota / privacy-mode failures.
    }
  }

  load()
  watch([order, visibility, widths], persist, { deep: true })

  function setWidth(key: string, width: number) {
    widths.value = { ...widths.value, [key]: Math.max(minWidth, Math.round(width)) }
  }

  function setVisibility(key: string, value: boolean) {
    visibility.value = { ...visibility.value, [key]: value }
  }

  function resetWidths() {
    widths.value = { ...options.defaultWidths }
  }

  function reset() {
    order.value = [...options.defaultOrder]
    visibility.value = defaultVisibility()
    widths.value = { ...options.defaultWidths }
  }

  return {
    order,
    visibility,
    widths,
    hasCustomWidths,
    setWidth,
    setVisibility,
    resetWidths,
    reset,
  }
}
