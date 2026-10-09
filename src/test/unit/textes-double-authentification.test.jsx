import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LEGAL_CONTENT } from '@features/legal/data/legal-content'

// Ce que les textes disent de la double authentification est vrai (audit du
// 2026-10-04, CPT-01 c, CPT-02).
//
// La FAQ la disait réservée aux administrateurs, la politique de
// confidentialité « aux comptes à privilèges » : la carte est offerte à TOUS
// les comptes, et le code est désormais demandé à chaque connexion. Et le lien
// « mot de passe oublié » d'un compte protégé tombait sur « Impossible de
// mettre à jour » quand Supabase exige le code (`insufficient_aal`).

const tout = (lang) => JSON.stringify(LEGAL_CONTENT[lang])

describe('les textes légaux', () => {
  it.each(['fr', 'en'])('%s : plus de « réservée aux administrateurs / comptes à privilèges »', (lang) => {
    expect(tout(lang)).not.toMatch(/comptes administrateurs|comptes à privilèges|administrator accounts|privileged accounts/i)
  })

  it('fr : la double authentification est offerte à tous, et demandée à chaque connexion', () => {
    expect(tout('fr')).toMatch(/tous les comptes/)
    expect(tout('fr')).toMatch(/à chaque connexion/)
  })
})

const completePasswordReset = vi.hoisted(() => vi.fn())
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ completePasswordReset, recoveryMode: true, user: { id: 'u-1' } }),
}))

import RecoveryPage from '@features/auth/pages/recovery-page'

describe('le lien « mot de passe oublié » d’un compte protégé', () => {
  it('Supabase exige le code (insufficient_aal) : la page le dit, au lieu de « Impossible de mettre à jour »', async () => {
    completePasswordReset.mockResolvedValue({ error: { code: 'insufficient_aal', message: 'AAL2 session is required to update email or password when MFA is enabled.' } })
    render(<MemoryRouter><RecoveryPage lang="fr" /></MemoryRouter>)
    const champs = document.querySelectorAll('input[type="password"]')
    fireEvent.change(champs[0], { target: { value: 'Un-Tres-Bon-Mot-De-Passe-2026!' } })
    fireEvent.change(champs[1], { target: { value: 'Un-Tres-Bon-Mot-De-Passe-2026!' } })
    fireEvent.submit(champs[0].closest('form'))
    await waitFor(() => expect(screen.getByText(/code de double authentification/)).toBeInTheDocument())
    expect(screen.queryByText('Impossible de mettre à jour. Réessaie.')).not.toBeInTheDocument()
  })
})
