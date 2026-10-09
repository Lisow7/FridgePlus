import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// La modale de défi ne laisse plus passer sans preuve (audit du 2026-10-04,
// CPT-01 a).
//
// Si la vérification ne répondait pas en 6 s, la modale appelait
// `onChallenged()` sans relire le niveau de la session : quiconque bloquait la
// requête passait côté navigateur. Elle sert à retirer la double
// authentification — l'action la plus sensible de la carte.

const mfa = vi.hoisted(() => ({ verify: vi.fn(), refresh: vi.fn() }))
vi.mock('@shared/hooks/use-mfa', () => ({
  useMFA: () => ({ factors: [{ id: 'f1', status: 'verified' }], verify: mfa.verify, refresh: mfa.refresh }),
}))
vi.mock('@shared/contexts/ui-provider', () => ({
  useUI: () => ({ lang: 'fr', darkMode: false }),
  useLang: () => ({ lang: 'fr' }),
  useDarkMode: () => ({ darkMode: false }),
}))
const api = vi.hoisted(() => ({ getAAL: vi.fn() }))
vi.mock('@shared/api/mfa', () => ({
  listMFAFactors: vi.fn(() => Promise.resolve({ totp: [], all: [], error: null })),
  getAAL: (...a) => api.getAAL(...a),
}))

import MFAChallengeModal from '@shared/ui/mfa-challenge-modal'

beforeEach(() => {
  vi.useFakeTimers()
  mfa.verify.mockReset().mockReturnValue(new Promise(() => {}))
  mfa.refresh.mockReset().mockResolvedValue()
  api.getAAL.mockReset()
})
afterEach(() => { vi.useRealTimers() })

async function verifierApresDelai(onChallenged) {
  render(<MFAChallengeModal lang="fr" onClose={() => {}} onChallenged={onChallenged} />)
  fireEvent.change(screen.getByLabelText('Code à 6 chiffres'), { target: { value: '123456' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Vérifier/ })) })
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
}

describe('la modale de défi, quand la vérification ne répond pas', () => {
  it('session toujours en aal1 : rien ne passe, et c’est dit', async () => {
    api.getAAL.mockResolvedValue({ current: 'aal1', next: 'aal2', error: null })
    const onChallenged = vi.fn()
    await verifierApresDelai(onChallenged)
    expect(onChallenged).not.toHaveBeenCalled()
    expect(screen.getByText(/La vérification n’a pas abouti/)).toBeInTheDocument()
  })

  it('session montée en aal2 : l’action peut suivre', async () => {
    api.getAAL.mockResolvedValue({ current: 'aal2', next: 'aal2', error: null })
    const onChallenged = vi.fn()
    await verifierApresDelai(onChallenged)
    expect(onChallenged).toHaveBeenCalledTimes(1)
  })
})
