import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// L'index de reconnaissance vocale se construit quand la voix démarre, pas à
// l'ouverture de chaque page (audit du 2026-10-04, PERF-06).
//
// Avant : à chaque chargement — FAQ comprise, et même sur Firefox, qui n'a pas
// la reconnaissance vocale — l'app parcourait ≈ 650 ingrédients, téléchargeait
// Fuse (9 Ko) et montait l'index ; puis recommençait à l'arrivée du catalogue.
// Pour une fonction que presque personne n'ouvre au démarrage.

const ingredientsCourants = vi.hoisted(() => ({
  valeur: {
    'fr-tomate': [{ id: 'fr-tomate', labels: { fr: 'Tomate', en: 'Tomato' }, emoji: '🍅' }],
  },
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ingredientsCourants.valeur,
}))
vi.mock('@shared/lib/matching/ingredient-text-matcher', async (importOriginal) => {
  const vrai = await importOriginal()
  return {
    ...vrai,
    buildFlatList: vi.fn(vrai.buildFlatList),
    buildFuseIndex: vi.fn(() => Promise.resolve(null)),
  }
})

class SpeechRecognitionMock {
  constructor() {
    this.start = vi.fn()
    this.stop = vi.fn()
    this.abort = vi.fn()
  }
}

import { buildFlatList, buildFuseIndex } from '@shared/lib/matching/ingredient-text-matcher'
import { useVoiceRecognition } from '@shared/hooks/use-voice-recognition'

describe('useVoiceRecognition — index construit à la demande', () => {
  beforeEach(() => {
    global.SpeechRecognition = SpeechRecognitionMock
    global.webkitSpeechRecognition = SpeechRecognitionMock
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    buildFlatList.mockClear()
    buildFuseIndex.mockClear()
  })
  afterEach(() => {
    delete global.SpeechRecognition
    delete global.webkitSpeechRecognition
    vi.restoreAllMocks()
  })

  it('au montage, aucun index n’est construit et Fuse n’est pas téléchargé', () => {
    renderHook(() => useVoiceRecognition({ lang: 'fr' }))

    expect(buildFlatList).not.toHaveBeenCalled()
    expect(buildFuseIndex).not.toHaveBeenCalled()
  })

  it('l’arrivée du catalogue ne reconstruit rien tant que la voix n’a pas servi', () => {
    const { rerender } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))
    ingredientsCourants.valeur = { ...ingredientsCourants.valeur, 'fr-carotte': [{ id: 'fr-carotte', labels: { fr: 'Carotte' }, emoji: '🥕' }] }
    rerender()

    expect(buildFuseIndex).not.toHaveBeenCalled()
  })

  it('le premier démarrage de la voix construit l’index, une fois', () => {
    const { result } = renderHook(() => useVoiceRecognition({ lang: 'fr' }))

    act(() => { result.current.start() })

    expect(buildFlatList).toHaveBeenCalledTimes(1)
    expect(buildFuseIndex).toHaveBeenCalledTimes(1)
  })
})
