import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const retirementComponents = [
  'src/components/PlayerCard.vue',
  'src/components/MobileDraftCard.vue',
  'src/components/DraftTable.vue',
]

describe('retirement team aliases', () => {
  it.each(retirementComponents)(
    'uses the last-played year when resolving the team in %s',
    (componentPath) => {
      const component = readFileSync(componentPath, 'utf8')
      const retirementFormatter = component.match(
        /function getRetirement(?:Text|TooltipText)[\s\S]*?\n}/,
      )?.[0]

      expect(retirementFormatter).toContain(
        'getTeamDisplayName(playsFor, playedUntilYear)',
      )
    },
  )
})
