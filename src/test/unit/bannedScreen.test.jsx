import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockDeleteAccount = vi.hoisted(() => vi.fn())

vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ deleteAccount: mockDeleteAccount }),
}))

import BannedScreen from '@features/auth/components/banned-screen'

const defaultProps = { lang: 'fr', darkMode: false, onShowSupport: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteAccount.mockResolvedValue({ error: null })
})

describe('BannedScreen', () => {

  // ─── Rendu ──────────────────────────────────────────────────────────────────
  describe('rendu', () => {
    it('affiche le titre "Compte suspendu" en français', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.getByText('Compte suspendu')).toBeInTheDocument()
    })

    it('affiche l\'emoji 🚫', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.getByText('🚫')).toBeInTheDocument()
    })

    it('affiche le message RGPD', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.getByText(/RGPD/i)).toBeInTheDocument()
    })

    it('affiche le bouton "Supprimer mon compte"', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.getByText(/supprimer mon compte/i)).toBeInTheDocument()
    })

    it('affiche le bouton "Contacter le support"', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.getByText(/contacter le support/i)).toBeInTheDocument()
    })

    it('ne montre pas la boîte de confirmation par défaut', () => {
      render(<BannedScreen {...defaultProps} />)
      expect(screen.queryByText(/supprimer définitivement/i)).not.toBeInTheDocument()
    })
  })

  // ─── Internationalisation ────────────────────────────────────────────────────
  describe('internationalisation', () => {
    it('affiche "Account suspended" en anglais', () => {
      render(<BannedScreen {...defaultProps} lang="en" />)
      expect(screen.getByText('Account suspended')).toBeInTheDocument()
    })

    // Sprint 7 PR S7.f — Tests ES/DE/JA retirés (langues
    // non plus supportées).

    it('fallback vers fr si langue inconnue', () => {
      render(<BannedScreen {...defaultProps} lang="xx" />)
      expect(screen.getByText('Compte suspendu')).toBeInTheDocument()
    })
  })

  // ─── Bouton support ──────────────────────────────────────────────────────────
  describe('bouton support', () => {
    it('appelle onShowSupport au clic', async () => {
      const onShowSupport = vi.fn()
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} onShowSupport={onShowSupport} />)
      await user.click(screen.getByText(/contacter le support/i))
      expect(onShowSupport).toHaveBeenCalledOnce()
    })
  })

  // ─── Dialogue de confirmation ────────────────────────────────────────────────
  describe('confirmation suppression', () => {
    it('ouvre la confirmation au clic sur "Supprimer mon compte"', async () => {
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} />)
      await user.click(screen.getByText(/supprimer mon compte/i))
      expect(screen.getByText(/supprimer définitivement/i)).toBeInTheDocument()
    })

    it('ferme la confirmation au clic "Annuler"', async () => {
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} />)
      await user.click(screen.getByText(/supprimer mon compte/i))
      await user.click(screen.getByText('Annuler'))
      expect(screen.queryByText(/supprimer définitivement/i)).not.toBeInTheDocument()
    })

    it('appelle deleteAccount en cliquant "Supprimer" dans la confirmation', async () => {
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} />)
      await user.click(screen.getByText(/supprimer mon compte/i))
      await user.click(screen.getByText('Supprimer'))
      await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledOnce())
    })

    it('affiche un message d\'erreur si deleteAccount échoue', async () => {
      mockDeleteAccount.mockResolvedValueOnce({ error: { message: 'Network error' } })
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} />)
      await user.click(screen.getByText(/supprimer mon compte/i))
      await user.click(screen.getByText('Supprimer'))
      await waitFor(() =>
        expect(screen.getByText(/une erreur est survenue/i)).toBeInTheDocument()
      )
    })

    it('le bouton Supprimer est désactivé pendant la suppression', async () => {
      mockDeleteAccount.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<BannedScreen {...defaultProps} />)
      await user.click(screen.getByText(/supprimer mon compte/i))
      await user.click(screen.getByText('Supprimer'))
      expect(screen.getByText('Supprimer')).toBeDisabled()
    })
  })
})
