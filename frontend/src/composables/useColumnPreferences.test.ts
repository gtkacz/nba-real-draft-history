import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { useColumnPreferences } from './useColumnPreferences'

const STORAGE_KEY = 'test:column-preferences'

function createPreferences() {
  return useColumnPreferences({
    storageKey: STORAGE_KEY,
    defaultOrder: ['team', 'player'],
    defaultWidths: { team: 150, player: 250 },
    toggleableKeys: ['team', 'player'],
  })
}

describe('useColumnPreferences width reset', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('reports whether any column width differs from its default', () => {
    const preferences = createPreferences()

    expect(preferences.hasCustomWidths.value).toBe(false)

    preferences.setWidth('team', 175)

    expect(preferences.hasCustomWidths.value).toBe(true)
  })

  it('restores default widths without changing order or visibility', () => {
    const preferences = createPreferences()
    preferences.order.value = ['player', 'team']
    preferences.setVisibility('player', false)
    preferences.setWidth('team', 175)
    preferences.setWidth('player', 300)

    preferences.resetWidths()

    expect(preferences.widths.value).toEqual({ team: 150, player: 250 })
    expect(preferences.order.value).toEqual(['player', 'team'])
    expect(preferences.visibility.value).toEqual({ team: true, player: false })
    expect(preferences.hasCustomWidths.value).toBe(false)
  })

  it('persists restored default widths', async () => {
    const preferences = createPreferences()
    preferences.setWidth('team', 175)
    preferences.resetWidths()

    await nextTick()

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').widths).toEqual({
      team: 150,
      player: 250,
    })
  })
})
