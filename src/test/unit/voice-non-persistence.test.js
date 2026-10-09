import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Verrou RGPD : la couche vocale n'écrit jamais l'audio ni le transcript brut.
// Seuls des IDs d'ingrédients validés transitent vers le stock.
vi.mock('@shared/hooks/use-voice-recognition', () => ({
  useVoiceRecognition: () => ({
    isListening: false,
    matchedIngredients: [{ id: 'vg-tomate', label: 'Tomates parlées' }],
    error: null, start: vi.fn(), stop: vi.fn(), clearAll: vi.fn(), restore: vi.fn(),
  }),
}))
vi.mock('@shared/hooks/use-consent', () => ({
  hasConsentedSync: () => true, useConsent: () => ({ setVoiceConsent: vi.fn() }),
}))

import { useVoiceFlow } from '@app/hooks/use-voice-flow'

describe('voix — non-persistance (RGPD)', () => {
  beforeEach(() => localStorage.clear())

  it('handleVoiceAdd écrit uniquement des IDs (jamais le transcript/libellé brut)', () => {
    const addStockBatch = vi.fn()
    const { result } = renderHook(() => useVoiceFlow({
      lang: 'fr',
      modals: {
        voiceConfirm: { open: vi.fn(), close: vi.fn() },
        voiceModal: { open: vi.fn(), close: vi.fn() },
      },
      activeSubcat: null, setActiveSubcat: vi.fn(), showRecipes: false, setShowRecipes: vi.fn(),
      closeAllDoors: vi.fn(), addStockBatch, removeStockBatch: vi.fn(),
    }))
    act(() => result.current.handleVoiceAdd(['vg-tomate']))
    // Seuls des IDs passent au stock
    expect(addStockBatch).toHaveBeenCalledWith(['vg-tomate'])
    // Aucune trace de transcript/libellé en localStorage
    const dump = JSON.stringify(localStorage)
    expect(dump).not.toContain('Tomates parlées')
  })
})
