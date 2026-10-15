import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// v3.412 PR-E — section Mes dépenses DÉPLACÉE vers /profile/depenses
// (page dédiée Premium-gated). Les tests sur le paywall/badge sont
// dans profile-spending-page.test.jsx.

vi.mock('@shared/contexts/data-provider', () => ({
  useBaseRecipes: () => ({
    recipes: [{ id: 'r1', emoji: '🥧' }],
    recipeNames: { 'r1': { fr: 'Tarte aux pommes', en: 'Apple pie' } },
  }),
  useCountries: () => ({}),
}))

vi.mock('@features/profile/hooks/use-profile-state', () => ({
  useProfileState: () => ({
    journalLogs:  [{ id: 'l1', recipe_id: 'r1', recipe_source: 'base', servings: 2, cooked_at: '2026-05-10T10:00:00Z' }],
    journalCount: 1,
    statsLogs:    [],
  }),
}))

vi.mock('@shared/api/community', () => ({
  getMyCustomRecipesForResolution: () => Promise.resolve([]),
}))

vi.mock('@features/profile/components/cooking-stats-section', () => ({
  default: () => <div data-testid="cooking-stats" />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({ lang: 'fr', darkMode: false, user: { id: 'u1' } }),
  }
})

import ProfileActivityPage from '@features/profile/pages/profile-activity-page'

describe('ProfileActivityPage (Sprint 11 S11.a.4 + PR-E)', () => {
  it('rend les 2 sections restantes (Vue d’ensemble + Journal)', () => {
    render(<MemoryRouter><ProfileActivityPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: /activité/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /vue d['’]ensemble/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /journal/i })).toBeInTheDocument()
  })

  it('n’affiche PAS la section Mes dépenses (déplacée vers /profile/depenses)', () => {
    render(<MemoryRouter><ProfileActivityPage /></MemoryRouter>)
    expect(screen.queryByRole('heading', { level: 2, name: /dépenses/i })).not.toBeInTheDocument()
  })

  it('affiche le journal avec la recette mockée', () => {
    render(<MemoryRouter><ProfileActivityPage /></MemoryRouter>)
    expect(screen.getByText('Tarte aux pommes')).toBeInTheDocument()
    expect(screen.getByText(/2 portions/)).toBeInTheDocument()
  })
})
