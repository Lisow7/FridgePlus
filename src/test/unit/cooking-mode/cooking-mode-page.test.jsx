// src/test/unit/cooking-mode/cooking-mode-page.test.jsx
//
// Test des branches de CookingModePage : gating Premium, états not-found /
// no-steps, écran idle, et log journal au finish. useCookingMode est mocké
// (son routage d'intents est couvert par use-cooking-mode.test.js) afin de
// piloter le statut et tester la glue de la page.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UIProvider } from '../../../shared/contexts/ui-provider'

// ── Mocks pilotables ────────────────────────────────────────────────
let mockRecipeById = { recipe: null, status: 'loading' }
let mockSubscription = { hasPremiumAccess: true }
let mockCooking = null
const mockNavigate = vi.fn()
const mockLogCooking = vi.fn()
let mockLogResult
const mockCelebrate = vi.fn()
const mockSignaler = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => ({ recipeId: 'r-test' }),
  useNavigate: () => mockNavigate,
}))
vi.mock('../../../features/recipes/hooks/use-recipe-by-id', () => ({
  useRecipeById: () => mockRecipeById,
}))
vi.mock('../../../shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({ recipeNames: { 'r-test': { fr: 'Tarte test', en: 'Test pie' } } }),
}))
vi.mock('../../../shared/hooks/use-subscription', () => ({
  useSubscription: () => mockSubscription,
}))
vi.mock('../../../shared/contexts/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('../../../shared/api/cooking-logs', () => ({
  logCooking: (...args) => { mockLogCooking(...args); return Promise.resolve(mockLogResult) },
}))
vi.mock('../../../shared/hooks/use-badge-celebration', () => ({
  useBadgeCelebration: () => mockCelebrate,
}))
vi.mock('../../../shared/hooks/use-save-error-toast', () => ({
  useSaveErrorToast: () => mockSignaler,
}))
vi.mock('../../../shared/ui/upgrade-gate', () => ({
  UpgradeGate: ({ feature }) => <div data-testid="upgrade-gate">{feature}</div>,
}))
vi.mock('../../../routes/page-skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}))
vi.mock('../../../features/cooking-mode/hooks/use-cooking-mode', () => ({
  useCookingMode: () => mockCooking,
}))

import CookingModePage from '../../../features/cooking-mode/components/cooking-mode-page'

// CookingHelpModal (rendu dès que la recette est prête) passe par
// ReusableModal, qui consomme useLang() → nécessite UIProvider.
function renderPage(props) {
  return render(<UIProvider><CookingModePage {...props} /></UIProvider>)
}

const baseRecipe = { id: 'r-test', isCustom: false, servings: 4, steps: { fr: ['Étape une', 'Étape deux'] } }

function idleCooking(overrides = {}) {
  return {
    status: 'idle',
    currentStep: '',
    progress: { current: 0, total: 2 },
    timer: null,
    speaking: false,
    handlers: { start: vi.fn(), stop: vi.fn(), next: vi.fn(), previous: vi.fn() },
    ...overrides,
  }
}

describe('CookingModePage — branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRecipeById = { recipe: baseRecipe, status: 'ok' }
    mockSubscription = { hasPremiumAccess: true }
    mockCooking = idleCooking()
    mockLogResult = { error: null }
  })

  // Hors audit, trouvé le 2026-10-05 : la célébration partait même quand le
  // journal n'avait rien noté.
  it('finished → le journal refuse : pas de célébration, et c’est dit', async () => {
    mockLogResult = { error: { message: 'Failed to fetch' } }
    mockCooking = idleCooking({ status: 'finished', progress: { current: 2, total: 2 } })
    renderPage({ lang: 'fr' })
    fireEvent.click(screen.getByText('Terminer'))
    await waitFor(() => expect(mockSignaler).toHaveBeenCalledWith('cooking'))
    expect(mockCelebrate).not.toHaveBeenCalled()
  })

  it('finished → le journal accepte : la célébration part, rien n’est dit (témoin)', async () => {
    mockCooking = idleCooking({ status: 'finished', progress: { current: 2, total: 2 } })
    renderPage({ lang: 'fr' })
    fireEvent.click(screen.getByText('Terminer'))
    await waitFor(() => expect(mockCelebrate).toHaveBeenCalledTimes(1))
    expect(mockSignaler).not.toHaveBeenCalled()
  })

  it('loading → skeleton', () => {
    mockRecipeById = { recipe: null, status: 'loading' }
    renderPage({ lang: 'fr' })
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
  })

  it('non-premium → UpgradeGate feature voice-cooking', () => {
    mockSubscription = { hasPremiumAccess: false }
    renderPage({ lang: 'fr' })
    expect(screen.getByTestId('upgrade-gate')).toHaveTextContent('voice-cooking')
  })

  // Recette embarquée montrée avant le catalogue : ses étapes arrivent avec la
  // fiche complète (audit du 2026-10-04, PERF-02). En attendant, on attend —
  // « introuvable » serait faux.
  it('recette embarquée en cours de complétion (sans étapes) → squelette, pas « introuvable »', () => {
    mockRecipeById = { recipe: { ...baseRecipe, steps: undefined }, status: 'ok', pending: true }
    renderPage({ lang: 'fr' })
    expect(screen.getByTestId('skeleton')).toBeInTheDocument()
    expect(screen.queryByText('Recette introuvable')).not.toBeInTheDocument()
  })

  it('recette sans étapes → message introuvable', () => {
    mockRecipeById = { recipe: { ...baseRecipe, steps: { fr: [] } }, status: 'ok' }
    renderPage({ lang: 'fr' })
    expect(screen.getByText('Recette introuvable')).toBeInTheDocument()
  })

  it('not-found → message introuvable', () => {
    mockRecipeById = { recipe: null, status: 'not-found' }
    renderPage({ lang: 'fr' })
    expect(screen.getByText('Recette introuvable')).toBeInTheDocument()
  })

  it('premium + étapes + idle → bouton Commencer + nom recette', () => {
    renderPage({ lang: 'fr' })
    expect(screen.getByText('Commencer')).toBeInTheDocument()
    expect(screen.getByText('Tarte test')).toBeInTheDocument()
  })

  it('finished → clic Terminer log le journal + navigate back', () => {
    mockCooking = idleCooking({ status: 'finished', progress: { current: 2, total: 2 } })
    renderPage({ lang: 'fr' })
    fireEvent.click(screen.getByText('Terminer'))
    expect(mockLogCooking).toHaveBeenCalledWith('user-1', {
      recipeId: 'r-test',
      recipeSource: 'base',
      servings: 4,
    })
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('finished → double clic Terminer ne log qu\'une fois', () => {
    mockCooking = idleCooking({ status: 'finished', progress: { current: 2, total: 2 } })
    renderPage({ lang: 'fr' })
    const btn = screen.getByText('Terminer')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(mockLogCooking).toHaveBeenCalledTimes(1)
  })

  it('recette custom → recipeSource custom', () => {
    mockRecipeById = { recipe: { ...baseRecipe, isCustom: true, name: { fr: 'Ma recette' }, steps: ['Une seule étape'] }, status: 'ok' }
    mockCooking = idleCooking({ status: 'finished', progress: { current: 1, total: 1 } })
    renderPage({ lang: 'fr' })
    fireEvent.click(screen.getByText('Terminer'))
    expect(mockLogCooking).toHaveBeenCalledWith('user-1', expect.objectContaining({ recipeSource: 'custom' }))
  })
})
