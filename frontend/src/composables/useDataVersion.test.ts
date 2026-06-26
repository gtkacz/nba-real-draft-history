import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/dataUrl', () => ({
  getDataUrl: (path: string) => `/data/${path}`,
}))

describe('loadDataVersion', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches data_version.json with no-store and memoizes the result', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ version: 'v1' }) } as Response)

    const { loadDataVersion } = await import('./useDataVersion')
    const first = await loadDataVersion()
    const second = await loadDataVersion()

    expect(first).toBe('v1')
    expect(second).toBe('v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/data/data_version.json', { cache: 'no-store' })
  })

  it('returns null when the version cannot be fetched', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({ ok: false, status: 404 } as Response)

    const { loadDataVersion } = await import('./useDataVersion')
    expect(await loadDataVersion()).toBeNull()
  })
})
