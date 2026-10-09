import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const etat = vi.hoisted(() => ({ lang: 'fr' }))
vi.mock('@shared/contexts/ui-provider', () => ({ useLang: () => ({ lang: etat.lang, setLang: vi.fn() }) }))

import { ToastProvider } from '@shared/ui/toast/toast-provider'
import { useSaveErrorToast, SAVE_ERROR_MESSAGES } from '@shared/hooks/use-save-error-toast'

// Audit du 2026-10-04, UX-02 et CPT-11 : une écriture refusée ne disait rien.
// Un seul message pour toute l'app, dit par le même crochet.
// Rappel `onReady` plutôt qu'une écriture dans une variable externe : le
// compilateur React refuse qu'un composant modifie une valeur déclarée hors de lui.
let signaler
function Sonde({ onReady }) {
  onReady(useSaveErrorToast())
  return null
}
const monter = () => render(<ToastProvider><Sonde onReady={(v) => { signaler = v }} /></ToastProvider>)

describe('useSaveErrorToast', () => {
  beforeEach(() => { etat.lang = 'fr' })

  it('dit ce qui n’a pas été enregistré, et quoi faire', () => {
    monter()
    act(() => { signaler('fridge') })
    expect(screen.getByText(SAVE_ERROR_MESSAGES.fr.fridge)).toBeInTheDocument()
    expect(SAVE_ERROR_MESSAGES.fr.fridge).toMatch(/pas enregistré/i)
    expect(SAVE_ERROR_MESSAGES.fr.fridge).toMatch(/réessaie/i)
  })

  it('est annoncé comme une alerte (région vive « assertive »)', () => {
    monter()
    act(() => { signaler('favorite') })
    const message = screen.getByText(SAVE_ERROR_MESSAGES.fr.favorite)
    expect(message.closest('[aria-live="assertive"]')).not.toBeNull()
  })

  it('un sujet inconnu, ou aucun : le message générique', () => {
    monter()
    act(() => { signaler() })
    expect(screen.getByText(SAVE_ERROR_MESSAGES.fr.generic)).toBeInTheDocument()
    act(() => { signaler('n-importe-quoi') })
    expect(screen.getAllByText(SAVE_ERROR_MESSAGES.fr.generic)).toHaveLength(1)
  })

  it('dix échecs d’affilée ne font pas dix messages', () => {
    monter()
    act(() => { for (let i = 0; i < 10; i++) signaler('fridge') })
    expect(screen.getAllByText(SAVE_ERROR_MESSAGES.fr.fridge)).toHaveLength(1)
  })

  it('en anglais aussi', () => {
    etat.lang = 'en'
    monter()
    act(() => { signaler('fridge') })
    expect(screen.getByText(SAVE_ERROR_MESSAGES.en.fridge)).toBeInTheDocument()
  })

  it('chaque sujet a ses deux langues', () => {
    expect(Object.keys(SAVE_ERROR_MESSAGES.en).sort()).toEqual(Object.keys(SAVE_ERROR_MESSAGES.fr).sort())
    for (const texte of [...Object.values(SAVE_ERROR_MESSAGES.fr), ...Object.values(SAVE_ERROR_MESSAGES.en)]) {
      expect(texte.length).toBeGreaterThan(10)
    }
  })

  it('se ferme tout seul', () => {
    vi.useFakeTimers()
    try {
      monter()
      act(() => { signaler('fridge') })
      act(() => { vi.advanceTimersByTime(7000) })
      expect(screen.queryByText(SAVE_ERROR_MESSAGES.fr.fridge)).toBeNull()
    } finally { vi.useRealTimers() }
  })
})
