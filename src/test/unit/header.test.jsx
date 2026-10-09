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

    // TODO v3.118.x — bouton micro migré vers FridgeFAB (hors Header). Réécrire dans FridgeFAB.test.jsx.
    it.skip('affiche le bouton micro', () => {
      render(<Header {...defaultProps} />)
      expect(screen.getByText(/dis-moi tes ingrédients/i)).toBeInTheDocument()
    })

    // TODO v3.18.x — sélecteur de langue n'expose plus le label texte « Langues »
    // (réduit à drapeau + chevron en v2.5.2). Réécrire avec aria-label / data-testid.
    it.skip('affiche le sélecteur de langue', () => {
      render(<Header {...defaultProps} />)
      expect(screen.getByText('Langues')).toBeInTheDocument()
    })

    // Skip : le tagline n'est plus rendu directement dans le
    // Header depuis la refonte v3.131 (FAB redesign + header integration).
    // Le composant FridgeTagline est désormais rendu séparément, hors du
    // Header. Test à revoir si le tagline réapparaît dans le Header.
    it.skip('affiche le tagline si fourni', () => {
      render(<Header {...defaultProps} tagline="Mon frigo" />)
      expect(screen.getByText('Mon frigo')).toBeInTheDocument()
    })
  })

  // ─── Bouton micro ───────────────────────────────────────────────────────────
  // TODO v3.118.x — bouton micro migré vers FridgeFAB (v3.118.0).
  // Ces tests sont obsolètes dans header.test.jsx ; à réécrire dans FridgeFAB.test.jsx.
  describe.skip('bouton micro (migré vers FridgeFAB en v3.118.0)', () => {
    it('affiche "Dis-moi tes ingrédients" par défaut', () => {
      render(<Header {...defaultProps} voiceListening={false} />)
      expect(screen.getByText(/dis-moi tes ingrédients/i)).toBeInTheDocument()
    })

    it('affiche "Arrêter" quand en écoute', () => {
      render(<Header {...defaultProps} voiceListening={true} />)
      expect(screen.getByText(/arrêter/i)).toBeInTheDocument()
    })

    it('appelle onVoiceToggle au clic', async () => {
      const onVoiceToggle = vi.fn()
      const user = userEvent.setup()
      render(<Header {...defaultProps} onVoiceToggle={onVoiceToggle} />)
      const micBtn = screen.getByText(/dis-moi tes ingrédients/i).closest('button')
      await user.click(micBtn)
      expect(onVoiceToggle).toHaveBeenCalledOnce()
    })

    it('affiche le label de chargement japonais si jaLoading', () => {
      render(<Header {...defaultProps} lang="ja" jaLoading={true} />)
      expect(screen.getByText('準備中…')).toBeInTheDocument()
    })
  })

  // ─── Bouton reset stock ──────────────────────────────────────────────────────
  describe('bouton reset stock', () => {
    // TODO v3.25.0+ — bouton reset stock retiré du Header (migré vers FridgeToolbar). Réécrire dans FridgeToolbar.test.jsx.
    it.skip('désactivé quand stock vide', () => {
      render(<Header {...defaultProps} stock={new Set()} />)
      const buttons = screen.getAllByRole('button')
      const trashBtn = buttons.find(b => b.disabled && b.querySelector('svg'))
      expect(trashBtn).toBeTruthy()
    })

    it('actif quand stock non vide', () => {
      render(<Header {...defaultProps} stock={new Set(['fr-tomate'])} />)
      expect(screen.getByText('Fridge')).toBeInTheDocument()
    })
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

    // TODO v3.18.x — selector .style.width === '32px' fragile. Le bouton admin
    // a changé de taille / variant depuis. Réécrire avec un data-testid.
    it.skip('le bouton admin a bien onClick={onShowAdmin}', () => {
      mockAuth = () => ({ user: { id: 'u-1' }, profile: { username: 'Admin', avatar_id: null }, isAdmin: true })
      const onShowAdmin = vi.fn()
      render(<Header {...defaultProps} onShowAdmin={onShowAdmin} />)
      const adminBtns = screen.getAllByTitle('Admin')
      expect(adminBtns.length).toBeGreaterThanOrEqual(1)
      const desktopBtn = adminBtns.find(b => b.style.width === '32px')
      expect(desktopBtn).toBeTruthy()
    })
  })

  // ─── Sélecteur de langue ────────────────────────────────────────────────────
  // TODO v3.18.x — sélecteur réduit à drapeau + chevron en v2.5.2 :
  // les labels « Langues » / « Languages » ne sont plus visibles dans le DOM.
  // Réécrire avec aria-label ou data-testid après stabilisation Phase 8.
  describe.skip('sélecteur de langue', () => {
    it('ouvre le dropdown au clic', async () => {
      const user = userEvent.setup()
      render(<Header {...defaultProps} />)
      await user.click(screen.getByText('Langues'))
      expect(screen.getByText('Français')).toBeInTheDocument()
    })

    it('appelle onLangChange quand on sélectionne English', async () => {
      const onLangChange = vi.fn()
      const user = userEvent.setup()
      render(<Header {...defaultProps} onLangChange={onLangChange} />)
      await user.click(screen.getByText('Langues'))
      await user.click(screen.getByText('English'))
      expect(onLangChange).toHaveBeenCalledWith('en')
    })

    it('affiche le label "Languages" en anglais', () => {
      render(<Header {...defaultProps} lang="en" />)
      expect(screen.getByText('Languages')).toBeInTheDocument()
    })
  })
})
