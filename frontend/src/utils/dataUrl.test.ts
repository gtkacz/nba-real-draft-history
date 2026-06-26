import { describe, expect, it } from 'vitest'
import { getDataUrl } from './dataUrl'

describe('getDataUrl', () => {
  it('returns an un-versioned URL when no version is given', () => {
    expect(getDataUrl('draft_history.json')).toBe('/data/draft_history.json')
  })

  it('appends an encoded ?v= when a version is given', () => {
    expect(getDataUrl('countries.json', 'abc123')).toBe('/data/countries.json?v=abc123')
  })
})
