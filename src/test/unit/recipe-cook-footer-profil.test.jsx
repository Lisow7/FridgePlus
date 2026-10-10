import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Le pied de la fiche recette montrait le verrou « Mode cuisine » à un abonné
// le temps que son profil arrive (audit du 2026-10-04, PREM-06). Tant que le
// profil n'est pas connu, ni bouton ni verrou : rien n'est affirmé.

vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: () => <div data-testid="verrou" /> }))
vi.mock('@shared/lib/observability/track', () => ({ track: vi.fn() }))

import { RecipeCookFooter } from '@features/recipes/components/recipe-cook-footer'

const T = { cookingMode: 'Mode cuisine vocal' }
function monter(props) {
  return render(
    <RecipeCookFooter
      recipe={{ id: 'r-1' }} recipeSteps={['Couper', 'Cuire']} user={{ id: 'u-1' }}
      isMobile={false} darkMode={false} lang="fr" t={T} navigate={vi.fn()}
      showCook={false}
      {...props}
    />,
  )
}

describe('RecipeCookFooter : le verrou Premium attend le profil', () => {
  it('profil en cours : ni bouton ni verrou', () => {
    monter({ hasPremiumAccess: false, profileLoading: true })
    expect(screen.queryByTestId('verrou')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mode cuisine vocal' })).toBeNull()
  })

  it('profil connu, pas Premium : le verrou', () => {
    monter({ hasPremiumAccess: false, profileLoading: false })
    expect(screen.getByTestId('verrou')).toBeInTheDocument()
  })

  it('profil connu, Premium : le bouton', () => {
    monter({ hasPremiumAccess: true, profileLoading: false })
    expect(screen.getByRole('button', { name: 'Mode cuisine vocal' })).toBeInTheDocument()
  })
})
