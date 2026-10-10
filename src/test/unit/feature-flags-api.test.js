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

  // Audit du 2026-10-04, ADM-28 : l'horodatage et l'auteur d'une bascule
  // venaient du navigateur (`updated_at`, `updated_by`). La base les pose
  // (déclencheur `trg_horodater_la_bascule`, lot 12l) : le client n'envoie que
  // la bascule.
  it('setFeatureFlag n’envoie que `enabled`, sur la bonne clé — l’heure et l’auteur sont posés par la base', async () => {
    await setFeatureFlag('scan_barcode', true)
    expect(mockUpdate).toHaveBeenCalledWith({ enabled: true })
    expect(mockEq).toHaveBeenCalledWith('key', 'scan_barcode')
    expect(mockSelectApresMaj).toHaveBeenCalledWith('key')
  })
})
