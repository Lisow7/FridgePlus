import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Règle des paliers d'accès (directive du 2026-05-20, ADR 0006) : un visiteur
// sans compte ne rencontre AUCUN point d'entrée Premium ; un compte gratuit
// les voit, verrouillés ; un Premium les a. L'audit du 2026-10-04 (PREM-08)
// a trouvé quatre entrées montrées aux visiteurs : le bouton « Substituts IA »,
// le verrou « Mode cuisine » du pied de fiche, le groupe « Bientôt » du
// guide avec « Voir ce qui est prévu », et `?modal=upgrade` qui ouvrait la
// fenêtre Premium à n'importe qui.

vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: () => <div data-testid="verrou" /> }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn() }))
vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openCreate: () => {} }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => false }))

import { RecipeCookFooter } from '@features/recipes/components/recipe-cook-footer'
import { useSubscriptionActivated } from '@shared/hooks/use-url-boot-effects'
import HelpGuide from '@features/onboarding/components/help-guide'

const T = { cookingMode: 'Mode cuisine vocal' }
function monterLePied(props) {
  return render(
    <RecipeCookFooter
      recipe={{ id: 'r-1' }} recipeSteps={['Couper', 'Cuire']}
      isMobile={false} darkMode={false} lang="fr" t={T} navigate={vi.fn()}
      hasPremiumAccess={false} showCook={false}
      {...props}
    />,
  )
}

describe('pied de fiche : le verrou « Mode cuisine » n’existe pas pour un visiteur', () => {
  it('visiteur : ni bouton, ni verrou — et rien du tout quand « J’ai cuisiné » n’y est pas', () => {
    const { container } = monterLePied({ user: null })
    expect(screen.queryByTestId('verrou')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mode cuisine vocal' })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  it('compte gratuit : le verrou', () => {
    monterLePied({ user: { id: 'u-1' } })
    expect(screen.getByTestId('verrou')).toBeInTheDocument()
  })
})

describe('?modal=upgrade', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/?modal=upgrade') })

  it('visiteur : rien ne s’ouvre, et l’adresse est nettoyée', () => {
    const ouvrir = vi.fn()
    renderHook(() => useSubscriptionActivated({ refreshProfile: vi.fn(), openUpgradeModal: ouvrir, user: null, loading: false }))
    expect(ouvrir).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
  })

  it('compte connecté : la fenêtre s’ouvre, une fois la session connue', () => {
    const ouvrir = vi.fn()
    const props = (p) => ({ refreshProfile: vi.fn(), openUpgradeModal: ouvrir, ...p })
    const { rerender } = renderHook((p) => useSubscriptionActivated(p), { initialProps: props({ user: null, loading: true }) })
    expect(ouvrir).not.toHaveBeenCalled()
    rerender(props({ user: { id: 'u-1' }, loading: false }))
    expect(ouvrir).toHaveBeenCalledTimes(1)
    rerender(props({ user: { id: 'u-1' }, loading: false }))
    expect(ouvrir).toHaveBeenCalledTimes(1)
  })
})

describe('guide « Aide & infos »', () => {
  const monterLeGuide = (props = {}) => render(<MemoryRouter><HelpGuide lang="fr" defaultOpen {...props} /></MemoryRouter>)

  it('visiteur : pas de groupe « Bientôt »', () => {
    monterLeGuide({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    expect(screen.getByText('Le frigo')).toBeInTheDocument()
    expect(screen.queryAllByText('Bientôt')).toHaveLength(0)
    expect(screen.queryByText('Panier')).toBeNull()
  })

  it('compte gratuit : le groupe est là, avec « Voir ce qui est prévu »', () => {
    monterLeGuide({ user: { id: 'u-1' }, onShowUpgrade: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    expect(screen.getAllByText('Bientôt').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Panier/ }))
    expect(screen.getByText(/^Voir ce qui est prévu/)).toBeInTheDocument()
  })
})

describe('la règle est écrite dans le dépôt', () => {
  it('ADR 0006, listé dans l’index', () => {
    const racine = process.cwd()
    expect(existsSync(resolve(racine, 'docs/adr/0006-paliers-d-acces-premium.md'))).toBe(true)
    const adr = readFileSync(resolve(racine, 'docs/adr/0006-paliers-d-acces-premium.md'), 'utf8')
    expect(adr).toMatch(/aucun point d'entrée/i)
    expect(readFileSync(resolve(racine, 'docs/adr/README.md'), 'utf8')).toContain('0006-paliers-d-acces-premium.md')
  })
})
