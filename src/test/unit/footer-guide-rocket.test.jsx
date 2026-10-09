import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Footer from '@app/layout/footer'
import { markCompleted } from '@features/onboarding/lib/getting-started-storage'

vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => true }))
vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@features/onboarding/lib/welcome-storage', () => ({ hasSeenWelcome: () => true }))

beforeEach(() => localStorage.clear())

function renderFooter(props = {}) {
  return render(
    <MemoryRouter>
      <Footer lang="fr" darkMode={false} isHome {...props} />
    </MemoryRouter>,
  )
}

// Chantier « rewards disparition » (2026-07-09) : une fois l'onboarding
// complété (isCompleted), la fusée « Bien démarrer » ne doit plus jamais
// réapparaître — la tâche est réalisée, pas de nag flottant permanent.
describe('Footer — fusée guide « Bien démarrer »', () => {
  it('affichée sur l\'accueil quand le guide est actif et non complété', () => {
    renderFooter()
    expect(screen.getByRole('button', { name: 'Bien démarrer' })).toBeInTheDocument()
  })

  it('disparaît définitivement une fois l\'onboarding complété (invité)', () => {
    markCompleted('guest')
    renderFooter()
    expect(screen.queryByRole('button', { name: 'Bien démarrer' })).not.toBeInTheDocument()
  })

  it('absente hors accueil (isHome=false), complété ou non', () => {
    renderFooter({ isHome: false })
    expect(screen.queryByRole('button', { name: 'Bien démarrer' })).not.toBeInTheDocument()
  })
})
