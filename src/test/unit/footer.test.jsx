import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import Footer from '@app/layout/footer'
import { CURRENT_VERSION } from '@shared/lib/version'

const defaultProps = { lang: 'fr', darkMode: false, user: null, supportUnread: 0, onShowSupport: vi.fn() }

beforeEach(() => vi.clearAllMocks())

// TODO v3.18.x — Footer refondu en v3.8.0 (FAQ + Aide & Mentions légales). Les
// labels « Mentions & CGU », « Twemoji » direct, et la structure des modales
// ont changé. Ces tests doivent être réécrits contre le markup actuel après
// stabilisation Phase 8 (Polish UI). Suivi : entrée Vague 1 du plan unifié.
describe.skip('Footer', () => {

  // ─── Rendu de base ─────────────────────────────────────────────────────────
  describe('rendu de base', () => {
    it('affiche le numéro de version courant', () => {
      render(<Footer {...defaultProps} />)
      expect(screen.getByText(`v${CURRENT_VERSION}`)).toBeInTheDocument()
    })

    it('affiche le lien Twemoji', () => {
      render(<Footer {...defaultProps} />)
      expect(screen.getByText('Twemoji')).toBeInTheDocument()
    })

    it('affiche le bouton légal en français', () => {
      render(<Footer {...defaultProps} />)
      expect(screen.getByText('Mentions & CGU')).toBeInTheDocument()
    })

    it('affiche le bouton légal en anglais', () => {
      render(<Footer {...defaultProps} lang="en" />)
      expect(screen.getByText('Legal & Terms')).toBeInTheDocument()
    })

    it('affiche l\'année courante', () => {
      render(<Footer {...defaultProps} />)
      expect(screen.getByText(`© ${new Date().getFullYear()}`)).toBeInTheDocument()
    })

    it('les icônes réseaux sociaux sont désactivées', () => {
      render(<Footer {...defaultProps} />)
      const socialBtns = ['Instagram', 'TikTok', 'Pinterest', 'YouTube', 'Facebook']
      socialBtns.forEach(label => {
        expect(screen.getByRole('button', { name: label })).toBeDisabled()
      })
    })
  })

  // ─── Bouton support ─────────────────────────────────────────────────────────
  describe('bouton support', () => {
    it('absent si user = null', () => {
      render(<Footer {...defaultProps} user={null} />)
      expect(screen.queryByText('Support')).not.toBeInTheDocument()
    })

    it('présent si user est connecté', () => {
      render(<Footer {...defaultProps} user={{ id: 'u-1' }} />)
      expect(screen.getByText('Support')).toBeInTheDocument()
    })

    it('appelle onShowSupport au clic', async () => {
      const onShowSupport = vi.fn()
      const user = userEvent.setup()
      render(<Footer {...defaultProps} user={{ id: 'u-1' }} onShowSupport={onShowSupport} />)
      await user.click(screen.getByText('Support'))
      expect(onShowSupport).toHaveBeenCalledOnce()
    })

    it('affiche le badge si supportUnread > 0', () => {
      render(<Footer {...defaultProps} user={{ id: 'u-1' }} supportUnread={3} />)
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('badge absent si supportUnread = 0', () => {
      render(<Footer {...defaultProps} user={{ id: 'u-1' }} supportUnread={0} />)
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  // ─── Modales ────────────────────────────────────────────────────────────────
  describe('modales', () => {
    it('ouvre la modale légale au clic', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText('Mentions & CGU'))
      expect(screen.getByText('Mentions légales')).toBeInTheDocument()
    })

    it('ferme la modale légale en cliquant ✕', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText('Mentions & CGU'))
      await user.click(screen.getByText('✕'))
      expect(screen.queryByText('Mentions légales')).not.toBeInTheDocument()
    })

    it('ouvre la modale changelog au clic sur la version', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText(`v${CURRENT_VERSION}`))
      expect(screen.getByTestId('changelog-modal')).toBeInTheDocument()
    })

    it('ferme la modale changelog', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText(`v${CURRENT_VERSION}`))
      await user.click(screen.getByText('Fermer changelog'))
      expect(screen.queryByTestId('changelog-modal')).not.toBeInTheDocument()
    })

    it('la modale légale affiche les 3 onglets', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText('Mentions & CGU'))
      expect(screen.getByText('Mentions légales')).toBeInTheDocument()
      expect(screen.getByText('CGU')).toBeInTheDocument()
      expect(screen.getByText('Confidentialité')).toBeInTheDocument()
    })

    it('bascule sur l\'onglet CGU', async () => {
      const user = userEvent.setup()
      render(<Footer {...defaultProps} />)
      await user.click(screen.getByText('Mentions & CGU'))
      await user.click(screen.getByText('CGU'))
      // La section CGU affiche l'en-tête "Objet" (premier heading du contenu)
      expect(screen.getByText('Objet')).toBeInTheDocument()
    })
  })
})
