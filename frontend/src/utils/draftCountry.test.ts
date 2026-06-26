import { describe, expect, it } from 'vitest'
import {
  buildCountryNameToCode,
  extractTrailingParenthetical,
  resolveDraftCountryCode,
  US_DRAFT_COUNTRY,
} from './draftCountry'

// Mirrors the runtime source: the keys of the loaded countries dataset.
const ISO_CODES = ['us', 'es', 'fr', 'gr', 'ca', 'au', 'ba', 'hk', 'tr', 'ge', 'br']
const nameToCode = buildCountryNameToCode(ISO_CODES)

describe('extractTrailingParenthetical', () => {
  it('returns the trailing parenthetical token', () => {
    expect(extractTrailingParenthetical('Valencia Basket (Spain)')).toBe('Spain')
    expect(extractTrailingParenthetical('Boston Whirlwinds (ABL) (United States)')).toBe('United States')
  })

  it('returns null when there is no trailing parenthetical', () => {
    expect(extractTrailingParenthetical('Abilene Christian')).toBeNull()
    expect(extractTrailingParenthetical('')).toBeNull()
  })
})

describe('resolveDraftCountryCode', () => {
  it('maps recognized foreign countries to their ISO code', () => {
    expect(resolveDraftCountryCode('Valencia Basket (Spain)', nameToCode)).toBe('es')
    expect(resolveDraftCountryCode('AEK Athens (Greece)', nameToCode)).toBe('gr')
    expect(resolveDraftCountryCode('Bauru (Brazil)', nameToCode)).toBe('br')
  })

  it('applies overrides for dataset-specific spellings and rollups', () => {
    expect(resolveDraftCountryCode('Besiktas Icrypex (Turkey)', nameToCode)).toBe('tr')
    expect(resolveDraftCountryCode('BC Siroki (Bosnia and Herzegovina)', nameToCode)).toBe('ba')
    expect(resolveDraftCountryCode('Bay Area Dragons (Hong Kong)', nameToCode)).toBe('hk')
    expect(resolveDraftCountryCode('Athlete Institute Prep (Ontario)', nameToCode)).toBe('ca')
    expect(resolveDraftCountryCode('Australian Institute of Sport (Australian Capital Territory)', nameToCode)).toBe('au')
  })

  it('treats "(Georgia)" as the US state, not the country', () => {
    expect(resolveDraftCountryCode('Overtime Elite (Georgia)', nameToCode)).toBe(US_DRAFT_COUNTRY)
  })

  it('falls back to the US for bare colleges, states, abbreviations, and "(United States)"', () => {
    expect(resolveDraftCountryCode('Abilene Christian', nameToCode)).toBe(US_DRAFT_COUNTRY)
    expect(resolveDraftCountryCode('Miami (FL)', nameToCode)).toBe(US_DRAFT_COUNTRY)
    expect(resolveDraftCountryCode('Lower Merion High School (Pennsylvania)', nameToCode)).toBe(US_DRAFT_COUNTRY)
    expect(resolveDraftCountryCode('Beijing Olympians (United States)', nameToCode)).toBe(US_DRAFT_COUNTRY)
    expect(resolveDraftCountryCode(null, nameToCode)).toBe(US_DRAFT_COUNTRY)
    expect(resolveDraftCountryCode('', nameToCode)).toBe(US_DRAFT_COUNTRY)
  })
})
