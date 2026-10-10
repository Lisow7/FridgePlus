import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

// Wrap render avec MemoryRouter — des éléments du Header consomment
// useNavigate() et exigent un Router context dans les tests. (BasketPopover,
// qui l'exigeait le premier, n'était plus rendu depuis la v0.40 ; supprimé
// le 2026-10-08.)
const render = (ui, options) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>, options)

// HelpGuide (rendu par HeaderActions) consomme useRecipeForm + useFeatureFlag — mock (pas de provider en test).
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openCreate: () => {} }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => mockAuth(),
}))

let mockWidth = 1200
vi.mock('@shared/hooks/use-window-width', () => ({
  useWindowWidth: () => mockWidth,
}))

vi.mock('@shared/ui/avatar-img', () => ({
  default: ({ size }) => <div data-testid="avatar" style={{ width: size, height: size }} />,
}))

let mockAuth = () => ({ user: null, profile: null, isAdmin: false })

import Header from '@app/layout/header'

const defaultProps = {
  lang: 'fr',
  stock: new Set(),
  onReset: vi.fn(),
  onVoiceToggle: vi.fn(),
  onLangChange: vi.fn(),
  onShowAuth: vi.fn(),
  onShowProfile: vi.fn(),
  onShowAdmin: vi.fn(),
  onSignOut: vi.fn(),
  onResetStock: vi.fn(),
  onCloseDoors: vi.fn(),
  darkMode: false,
  voiceListening: false,
  jaLoading: false,
  pendingCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth = () => ({ user: null, profile: null, isAdmin: false })
  mockWidth = 1200
})

describe('Header', () => {

  // ─── Rendu de base ─────────────────────────────────────────────────────────
  describe('rendu de base', () => {
    it('affiche le logo Fridge', () => {
      render(<Header {...defaultProps} />)
      expect(screen.getByText('Fridge')).toBeInTheDocument()
    })

    it('affiche le "+" du logo en couleur', () => {
      render(<Header {...defaultProps} />)
      expect(screen.getByText('+')).toBeInTheDocument()
    })

    // Le micro, le bouton « Vider » et le sélecteur de langue ont quitté
    // l'en-tête (FridgeFAB, panneau Inventaire, menu utilisateur) : leurs tests
    // vivent là-bas (fridge-fab, inventory-panel, lang-theme-prefs). Sept tests
    // ignorés les attendaient encore ici (audit du 2026-10-04, ARCH-17 (2)).
  })

  // ─── Auth ────────────────────────────────────────────────────────────────────
  describe('état authentification', () => {
    it('affiche le bouton Se connecter si non authentifié', () => {
      render(<Header {...defaultProps} />)
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })

    it('affiche l\'avatar si authentifié', () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      render(<Header {...defaultProps} />)
      expect(screen.getByTestId('avatar')).toBeInTheDocument()
    })

    it('affiche le username si authentifié', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      // Le trigger avatar a désormais un aria-label générique peu importe l'état
      // (cf. spec 2026-07-09) ; le username s'affiche dans l'en-tête du menu ouvert.
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    it('affiche le bouton admin si isAdmin', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Admin', avatar_id: null }, isAdmin: true })
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
    })

    it('badge admin visible si pendingCount > 0', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Admin', avatar_id: null }, isAdmin: true })
      const user = userEvent.setup()
      render(<Header {...defaultProps} pendingCount={5} />)
      // Le badge est dans le dropdown UserMenu — il faut l'ouvrir.
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)
    })

    it('UserMenu "Mon profil" est un lien vers /profile', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      const profileItem = screen.getByRole('menuitem', { name: /profil/i })
      expect(profileItem).toHaveAttribute('href', '/profile')
    })

    // Décision du 2026-10-08 (2026-10-08, `nom_reglages = langue_theme`) : deux
    // « Préférences » coexistaient — cette section du menu (langue, thème) et
    // l'onglet du profil (pays, forme du frigo, allergènes, budget…).
    it('UserMenu : la section des réglages s’appelle « Langue et thème », pas « Préférences »', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      expect(screen.getByText('Langue et thème')).toBeInTheDocument()
      expect(screen.queryByText('Préférences')).not.toBeInTheDocument()
    })

    it('affiche le badge panier « Bientôt » pour un user non-premium', async () => {
      // Régression : le tier du panier doit être 'soon' (→ « Bientôt »),
      // pas 'cart' (clé inconnue de TierBadge = badge silencieusement absent).
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      // Le panier est dans le dropdown UserMenu — ouvrir via le trigger avatar (aria-label générique).
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      expect(screen.getByText('Bientôt')).toBeInTheDocument()
    })

    it('affiche l\'avatar comme trigger même en mobile', () => {
      mockWidth = 375
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Alice', avatar_id: null }, isAdmin: false })
      render(<Header {...defaultProps} />)
      expect(screen.getAllByTestId('avatar').length).toBeGreaterThanOrEqual(1)
    })

    it('« Panneau admin » du menu appelle onShowAdmin', async () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Admin', avatar_id: null }, isAdmin: true })
      const onShowAdmin = vi.fn()
      const user = userEvent.setup()
      render(<Header {...defaultProps} onShowAdmin={onShowAdmin} />)
      await user.click(screen.getByRole('button', { name: 'Menu utilisateur' }))
      await user.click(screen.getByRole('menuitem', { name: /Panneau admin/ }))
      expect(onShowAdmin).toHaveBeenCalledOnce()
    })
  })
})
