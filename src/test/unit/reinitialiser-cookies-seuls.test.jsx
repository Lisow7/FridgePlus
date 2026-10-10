import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Décision du 2026-10-08 : « Réinitialiser mes choix » ne touche qu'aux cookies.
// Il retirait aussi l'accord à la charte de la communauté : la seule preuve
// datée de cet accord disparaissait, et il fallait la ré-accepter pour publier.
// Le retrait de la charte reste dans le profil, comme un geste à part (testé
// avec la page Identité).

const reset = vi.fn()
vi.mock('@shared/hooks/use-consent', () => ({
  useConsent: () => ({ consent: { timestamp: Date.now(), errors: false, usage: false }, hasDecided: true, reset }),
}))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@features/push-notifications', () => ({ usePushSubscription: () => ({ supported: false }) }))
vi.mock('../../features/legal/components/cookie-modal', () => ({ default: () => null }))
const revoke = vi.hoisted(() => vi.fn())
vi.mock('@shared/api/community', () => ({ revokeCommunityTerms: (...a) => revoke(...a) }))

import ConfidentialityPanel from '@features/legal/components/confidentiality-panel'

beforeEach(() => {
  reset.mockReset()
  revoke.mockReset()
  localStorage.clear()
})

describe('« Réinitialiser mes choix » : les cookies, et seulement eux', () => {
  it('remet les choix de cookies à zéro, sans toucher à l’accord à la charte', () => {
    localStorage.setItem('fridge-community-terms-seen', '1')
    render(<ConfidentialityPanel lang="fr" />)
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser mes choix' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(revoke).not.toHaveBeenCalled()
    expect(localStorage.getItem('fridge-community-terms-seen')).toBe('1')
  })

  it('l’avertissement dit ce que fait le bouton — et ce qu’il ne fait pas', () => {
    render(<ConfidentialityPanel lang="fr" />)
    expect(screen.getByText('Réinitialiser efface tes préférences cookies : la bannière revient, et tu refais tes choix. Ton accord à la charte de la communauté et les données de ton compte (frigo, recettes, favoris, publications) ne changent pas.')).toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    render(<ConfidentialityPanel lang="en" />)
    expect(screen.getByText('Resetting clears your cookie preferences: the banner comes back and you choose again. Your agreement to the community charter and your account data (fridge, recipes, favorites, published posts) are not affected.')).toBeInTheDocument()
  })
})
