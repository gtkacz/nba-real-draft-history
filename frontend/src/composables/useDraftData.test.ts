import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftData } from './useDraftData'

vi.mock('@/utils/dataUrl', () => ({
  getDataUrl: (path: string, version?: string | null) =>
    version ? `/data/${path}?v=${version}` : `/data/${path}`,
}))

vi.mock('@/composables/useDataVersion', () => ({
  loadDataVersion: vi.fn(async () => 'testver'),
}))

describe('useDraftData loadDraftData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches one consolidated draft_history.json and derives teamLogo', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          year: 2018,
          round: 1,
          pick: 3,
          player: 'Luka Doncic',
          position: 'F',
          height: '6-8',
          weight: 230,
          age: 19,
          preDraftTeam: 'Real Madrid (Spain)',
          class: '1999 DOB *',
          draftTrades: 'ATL to DAL',
          yearsOfService: 7,
          team: 'DAL',
          awards: { 'NBA Most Valuable Player': 1 },
        },
      ],
    } as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/data/draft_history.json?v=testver')
    expect(draftData.filteredData.value).toHaveLength(1)
    expect(draftData.filteredData.value[0]?.teamLogo).toBe(
      'https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/dal.svg',
    )
  })

  it('keeps picks with invalid measurements at the default range, excluding them only once a measurement filter is applied', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          year: 2020,
          round: 1,
          pick: 1,
          player: 'Valid Measurements',
          position: 'G',
          height: '6-3',
          weight: 200,
          age: 20,
          preDraftTeam: 'College',
          class: '',
          draftTrades: null,
          yearsOfService: 5,
          team: 'DAL',
        },
        {
          year: 2020,
          round: 1,
          pick: 2,
          player: 'Missing Measurements',
          position: 'G',
          height: '',
          weight: 0,
          age: 0,
          preDraftTeam: 'College',
          class: '',
          draftTrades: null,
          yearsOfService: undefined,
          team: 'BOS',
        },
      ],
    } as unknown as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    // Both picks survive the untouched default ranges.
    expect(draftData.filteredData.value).toHaveLength(2)

    // Narrowing height excludes the pick with no measurement.
    draftData.heightRange.value = [72, 84]
    expect(draftData.filteredData.value.map((p) => p.player)).toEqual(['Valid Measurements'])
  })

  it('sets an error when draft_history.json cannot be fetched', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    expect(draftData.error.value).toBe('Failed to fetch draft_history.json: 404')
  })
})
