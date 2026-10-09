// La page /guide rend les 5 étapes de la visite, ancrées (la FAQ y renvoie),
// avec les icônes du menu là où une action est désignée.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/contexts/auth-provider', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@shared/hooks/use-subscription', () => ({ useSubscription: () => ({ isPremium: false }) }))
vi.mock('@shared/hooks/use-document-title', () => ({ useDocumentTitle: () => {} }))

import GuidePage from '@features/onboarding/pages/guide-page'

const rendre = () => render(<MemoryRouter><GuidePage lang="fr" /></MemoryRouter>)

describe('page Comment ça marche', () => {
  it('rend cinq étapes ancrées etape-1 … etape-5, dans l’ordre du menu', () => {
    rendre()
    const titres = [1, 2, 3, 4, 5].map(n => document.getElementById(`etape-${n}`)?.querySelector('h2')?.textContent)
    expect(titres).toEqual(['Le bouton orange', 'Remplis ton frigo', 'Vérifier ce que tu as', 'Ce que tu peux cuisiner', 'Aller plus loin'])
  })

  it('montre le glyphe du bouton orange à l’étape 1 et les icônes Lucide des trois façons de remplir', () => {
    rendre()
    expect(document.getElementById('etape-1').querySelector('[data-fab-glyph]')).not.toBeNull()
    expect(document.getElementById('etape-2').querySelectorAll('svg').length).toBeGreaterThanOrEqual(3)
  })

  it('annonce cinq étapes dans son sous-titre', () => {
    rendre()
    expect(screen.getByText(/cinq étapes/)).toBeInTheDocument()
  })
})
