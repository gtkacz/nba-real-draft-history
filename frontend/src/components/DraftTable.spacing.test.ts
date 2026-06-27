import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('DraftTable mobile back-to-top spacing', () => {
  it('adds the mobile insets and respects safe areas', () => {
    const component = readFileSync('src/components/DraftTable.vue', 'utf8')
    const mobileButtonStyles = component.match(
      /\.back-to-top-btn[\s\S]*?@media \(max-width: 959px\) \{([\s\S]*?)\n  \}/,
    )?.[1]

    expect(mobileButtonStyles).toContain(
      'bottom: calc(36px + env(safe-area-inset-bottom));',
    )
    expect(mobileButtonStyles).toContain(
      'right: calc(24px + env(safe-area-inset-right));',
    )
  })
})
