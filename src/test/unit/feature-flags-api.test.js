import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock du client supabase avant l'import du module testé.
const mockOrder = vi.fn()
const mockSelect = vi.fn(() => ({ order: mockOrder }))
// L'écriture demande la ligne touchée (audit ADM-26) : `.eq(...).select('key')`.
const mockSelectApresMaj = vi.fn(() => Promise.resolve({ data: [{ key: 'scan_barcode' }], error: null }))
const mockEq = vi.fn(() => ({ select: mockSelectApresMaj }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockGetUser = vi.fn(() => ({ data: { user: { id: 'admin-123' } } }))
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }))

vi.mock('@shared/lib/supabase/client', () => ({
  supabase: { from: (...a) => mockFrom(...a), auth: { getUser: (...a) => mockGetUser(...a) } },
}))

import { fetchFeatureFlags, setFeatureFlag } from '@shared/api/feature-flags'

describe('feature-flags API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetchFeatureFlags renvoie les lignes triées', async () => {
    mockOrder.mockResolvedValueOnce({ data: [{ key: 'scan_barcode', enabled: false }], error: null })
    const rows = await fetchFeatureFlags()
    expect(mockFrom).toHaveBeenCalledWith('feature_flags')
    expect(rows).toEqual([{ key: 'scan_barcode', enabled: false }])
  })

  it('fetchFeatureFlags renvoie [] en cas d\'erreur', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const rows = await fetchFeatureFlags()
    expect(rows).toEqual([])
  })

  it('setFeatureFlag update enabled + updated_by sur la bonne clé', async () => {
    await setFeatureFlag('scan_barcode', true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, updated_by: 'admin-123' }),
    )
    expect(mockEq).toHaveBeenCalledWith('key', 'scan_barcode')
    expect(mockSelectApresMaj).toHaveBeenCalledWith('key')
  })
})
