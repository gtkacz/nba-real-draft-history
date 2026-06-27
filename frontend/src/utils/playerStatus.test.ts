import { describe, expect, it } from 'vitest'

import { getPlayerStatus } from './playerStatus'

describe('getPlayerStatus', () => {
  it('classifies a player with no NBA identity or playing data as never debuted', () => {
    expect(
      getPlayerStatus(
        {
          nba_id: null,
          played_until_year: null,
          plays_for: null,
        },
        2025,
      ),
    ).toBe('never-debuted')
  })

  it.each([
    { nba_id: 123, played_until_year: null, plays_for: null },
    { nba_id: null, played_until_year: null, plays_for: 'MIL' },
  ])('does not classify partial NBA data as never debuted', (pick) => {
    expect(getPlayerStatus(pick, 2025)).toBe('unknown')
  })

  it('does not coerce a null playing year into retirement', () => {
    expect(
      getPlayerStatus(
        {
          nba_id: 123,
          played_until_year: null,
          plays_for: null,
        },
        2025,
      ),
    ).toBe('unknown')
  })

  it('classifies known playing years relative to the current season', () => {
    expect(getPlayerStatus({ played_until_year: 2024 }, 2025)).toBe('retired')
    expect(getPlayerStatus({ played_until_year: 2025 }, 2025)).toBe('active')
  })
})
