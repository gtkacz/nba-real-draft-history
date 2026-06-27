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

  it('excludes never-debuted players from both retirement filter results', async () => {
    const fetchMock = vi.mocked(fetch)
    const basePick = {
      year: 2025,
      round: 1,
      position: 'F',
      height: '6-8',
      weight: 220,
      age: 20,
      preDraftTeam: 'Club',
      class: '',
      draftTrades: null,
      yearsOfService: 0,
      team: 'MIL',
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          ...basePick,
          pick: 1,
          player: 'Never Debuted',
          nba_id: null,
          played_until_year: null,
          plays_for: null,
        },
        {
          ...basePick,
          pick: 2,
          player: 'Retired Player',
          nba_id: 2,
          played_until_year: 2020,
        },
        {
          ...basePick,
          pick: 3,
          player: 'Active Player',
          nba_id: 3,
          played_until_year: 9999,
          plays_for: 'MIL',
        },
      ],
    } as unknown as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    draftData.retiredFilter.value = 'retired'
    expect(draftData.filteredData.value.map((pick) => pick.player)).toEqual(['Retired Player'])

    draftData.retiredFilter.value = 'not-retired'
    expect(draftData.filteredData.value.map((pick) => pick.player)).toEqual(['Active Player'])
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

describe('useDraftData negation filters', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function loadPicks(picks: Record<string, unknown>[]) {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => picks,
    } as unknown as Response)
    const draftData = useDraftData()
    await draftData.loadDraftData()
    return draftData
  }

  function players(draftData: Awaited<ReturnType<typeof loadPicks>>): string[] {
    return draftData.filteredData.value.map((p) => p.player as string)
  }

  it('excludes the selected team when "Drafted By" is negated', async () => {
    const draftData = await loadPicks([
      { year: 2015, round: 1, pick: 1, player: 'A', team: 'DAL' },
      { year: 2015, round: 1, pick: 2, player: 'B', team: 'BOS' },
    ])

    draftData.selectedTeam.value = ['DAL']
    expect(players(draftData)).toEqual(['A'])

    draftData.excludeModes.value = { ...draftData.excludeModes.value, team: true }
    expect(players(draftData)).toEqual(['B'])
  })

  it('combines an include filter with a negated filter (plays for CHI, NOT drafted by CHI)', async () => {
    const draftData = await loadPicks([
      { year: 2015, round: 1, pick: 1, player: 'HomegrownBull', team: 'CHI', plays_for: 'CHI', played_until_year: 2999 },
      { year: 2015, round: 1, pick: 2, player: 'TradedToBull', team: 'LAL', plays_for: 'CHI', played_until_year: 2999 },
    ])

    draftData.selectedPlaysFor.value = ['CHI']
    draftData.selectedTeam.value = ['CHI']
    draftData.excludeModes.value = { ...draftData.excludeModes.value, team: true }

    expect(players(draftData)).toEqual(['TradedToBull'])
  })

  it('"Currently Plays For" negation keeps only active players on another team', async () => {
    const draftData = await loadPicks([
      { year: 2015, round: 1, pick: 1, player: 'ActiveDAL', team: 'DAL', plays_for: 'DAL', played_until_year: 2999 },
      { year: 2015, round: 1, pick: 2, player: 'ActiveBOS', team: 'BOS', plays_for: 'BOS', played_until_year: 2999 },
      { year: 2015, round: 1, pick: 3, player: 'RetiredDAL', team: 'DAL', plays_for: 'DAL', played_until_year: 2000 },
    ])

    draftData.selectedPlaysFor.value = ['DAL']
    draftData.excludeModes.value = { ...draftData.excludeModes.value, playsFor: true }

    // Active player on another team survives; the retired player does not.
    expect(players(draftData)).toEqual(['ActiveBOS'])
  })

  it('excludes the US to yield all non-US draft origins', async () => {
    const draftData = await loadPicks([
      { year: 2015, round: 1, pick: 1, player: 'Foreign', team: 'OKC', preDraftTeam: 'Anadolu Efes (Turkey)' },
      { year: 2015, round: 1, pick: 2, player: 'Domestic', team: 'DUKE', preDraftTeam: 'Duke' },
    ])

    draftData.selectedDraftCountries.value = ['us']
    expect(players(draftData)).toEqual(['Domestic'])

    draftData.excludeModes.value = { ...draftData.excludeModes.value, draftCountries: true }
    expect(players(draftData)).toEqual(['Foreign'])
  })

  it('negating Nationality keeps only known, non-matching nationalities', async () => {
    const draftData = await loadPicks([
      { year: 2015, round: 1, pick: 1, player: 'American', team: 'DAL', origin_country: 'USA' },
      { year: 2015, round: 1, pick: 2, player: 'Canadian', team: 'TOR', origin_country: 'Canada' },
      { year: 2015, round: 1, pick: 3, player: 'Unknown', team: 'BOS', origin_country: '' },
    ])

    draftData.selectedNationalities.value = ['usa']
    draftData.excludeModes.value = { ...draftData.excludeModes.value, nationalities: true }

    expect(players(draftData)).toEqual(['Canadian'])
  })
})

describe('useDraftData "Once Owned By" scope', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  async function loadChainPicks() {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => [
        // Chain WAS -> NYK -> OKC: first owner WAS, NYK is a middle owner.
        { year: 2015, round: 1, pick: 1, player: 'MultiHop', team: 'OKC', draftTrades: 'WAS to NYK NYK to OKC' },
        // Chain BOS -> MIA: first owner BOS, no NYK involvement.
        { year: 2015, round: 1, pick: 2, player: 'OtherChain', team: 'MIA', draftTrades: 'BOS to MIA' },
        // Never traded: carries no ownership history.
        { year: 2015, round: 1, pick: 3, player: 'NeverTraded', team: 'LAL', draftTrades: null },
      ],
    } as unknown as Response)
    const draftData = useDraftData()
    await draftData.loadDraftData()
    return draftData
  }

  function players(draftData: Awaited<ReturnType<typeof loadChainPicks>>): string[] {
    return draftData.filteredData.value.map((p) => p.player as string)
  }

  it('matches a middle owner only in "any" scope, not "first"', async () => {
    const draftData = await loadChainPicks()
    draftData.selectedOnceOwnedBy.value = ['NYK']

    draftData.onceOwnedByScope.value = 'any'
    expect(players(draftData)).toEqual(['MultiHop'])

    draftData.onceOwnedByScope.value = 'first'
    expect(players(draftData)).toEqual([])
  })

  it('matches the original owner in "first" scope', async () => {
    const draftData = await loadChainPicks()
    draftData.selectedOnceOwnedBy.value = ['WAS']
    draftData.onceOwnedByScope.value = 'first'
    expect(players(draftData)).toEqual(['MultiHop'])
  })

  it('negation keeps traded picks that do not match, but never-traded picks stay out', async () => {
    const draftData = await loadChainPicks()
    draftData.selectedOnceOwnedBy.value = ['NYK']
    draftData.onceOwnedByScope.value = 'any'
    draftData.excludeModes.value = { ...draftData.excludeModes.value, onceOwnedBy: true }

    // MultiHop is excluded (owned by NYK); OtherChain survives; NeverTraded has no
    // ownership history and is not returned by the ownership filter in either mode.
    expect(players(draftData)).toEqual(['OtherChain'])
  })
})
