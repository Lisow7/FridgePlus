import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// « Réinitialiser mes choix » retire aussi l'acceptation de la charte de la
// communauté, en base. Le résultat n'était pas lu (audit du 2026-10-04,
// ARCH-05) : refusée, la charte restait acceptée côté serveur alors que la
// personne croyait l'avoir retirée — un retrait de consentement qui n'a pas eu
// lieu. On le dit, pour qu'elle puisse réessayer.

const reset = vi.fn()
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: { timestamp: Date.now(), errors: false, usage: false }, hasDecided: true, reset }),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => ({ supported: false }) }))
vi.mock('../../features/legal/components/cookie-modal', () => ({ default: () => null }))
const revoke = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/community', () => ({ revokeCommunityTerms: (...a) => revoke(...a) }))
const signaler = vi.hoisted(() => vi.fn())
vi.mock('@shared/hooks/use-save-error-toast', () => ({ useSaveErrorToast: () => signaler }))

import ConfidentialityPanel from '@features/legal/components/confidentiality-panel'

beforeEach(() => { reset.mockReset(); revoke.mockReset(); signaler.mockReset() })

describe('le retrait de la charte, en base', () => {
  it('refusé : la personne le sait', async () => {
    revoke.mockResolvedValue({ error: 'permission denied' })
    render(<ConfidentialityPanel lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser mes choix' }))
    await waitFor(() => expect(signaler).toHaveBeenCalledWith('setting'))
    expect(revoke).toHaveBeenCalledWith('u1')
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('accepté : rien à dire', async () => {
    revoke.mockResolvedValue({ ok: true })
    render(<ConfidentialityPanel lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser mes choix' }))
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('u1'))
    expect(signaler).not.toHaveBeenCalled()
  })
})
