import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('application branding', () => {
  it('uses the basketball hoop icon in the branding title', () => {
    const app = readFileSync('src/App.vue', 'utf8')
    const icons = readFileSync('src/plugins/icons.ts', 'utf8')

    expect(app).toContain('<v-icon icon="mdi-basketball-hoop" class="brand-logo"')
    expect(app).not.toContain('alt="NBA logo"')
    expect(icons).toContain("'mdi-basketball-hoop': mdiBasketballHoop")
  })
})
