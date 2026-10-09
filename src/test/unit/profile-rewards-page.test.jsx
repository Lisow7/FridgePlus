import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

let mockLogs = { statsLogs: [], cleanStatsLogs: [], streak: { current: 0, best: 0 }, badges: [], resolveCountry: () => null }
const mockCtx = vi.hoisted(() => ({ searchParams: new URLSearchParams(), profile: { unlocked_banners: [] } }))
vi.mock('@features/profile/hooks/use-cooking-logs', () => ({
  useCookingLogs: () => mockLogs,
}))
vi.mock('@shared/contexts/auth-provider', () => ({
  useAuth: () => ({ updateProfile: vi.fn(() => Promise.resolve({ error: null })) }),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useOutletContext: () => ({ lang: 'fr', darkMode: false, user: { id: 'u1' }, profile: mockCtx.profile }),
    useSearchParams: () => [mockCtx.searchParams, vi.fn()],
  }
})
// StreakCard/BadgesGrid rendus tels quels ; ProfileSection est neutre.

import ProfileRewardsPage from '@features/profile/pages/profile-rewards-page'

// jsdom n'implémente pas scrollIntoView — le stub évite un throw dans l'effet ?reward=.
beforeAll(() => { window.HTMLElement.prototype.scrollIntoView = vi.fn() })

describe('ProfileRewardsPage', () => {
  beforeEach(() => {
    mockCtx.searchParams = new URLSearchParams()
    mockCtx.profile = { unlocked_banners: [] }
    window.HTMLElement.prototype.scrollIntoView.mockClear()
  })

  it('affiche le titre Récompenses', () => {
    mockLogs = { statsLogs: [], cleanStatsLogs: [], streak: { current: 0, best: 0 }, badges: [] }
    render(<ProfileRewardsPage />)
    expect(screen.getByText('Récompenses')).toBeInTheDocument()
  })

  it('sans logs et sans badges : message d\'amorce, pas de section Progression', () => {
    mockLogs = { statsLogs: [], cleanStatsLogs: [], streak: { current: 0, best: 0 }, badges: [] }
    render(<ProfileRewardsPage />)
    expect(screen.getByText(/débloquer ta série/i)).toBeInTheDocument()
    expect(screen.queryByText('Progression')).not.toBeInTheDocument()
  })

  it('avec des badges dispo (même 0 recette cuisinée) : affiche la section Progression', () => {
    // Reproduit le cas réel du CTA onboarding App.jsx (0 recette, computeBadges renvoie
    // quand même les 14 paliers verrouillés) : la grille doit être visible dès que
    // `badges` est non vide, PAS seulement quand cleanStatsLogs.length > 0.
    mockLogs = {
      statsLogs: [],
      cleanStatsLogs: [],
      streak: { current: 0, best: 0 },
      badges: [{ id: 'volume-1', theme: 'volume', tier: 1, threshold: 1, emoji: '🍳', label: { fr: 'Première recette', en: 'First' }, unlocked: false, isNextTier: true, progress: { current: 0, value: 0, threshold: 1 }, reward: { banner: 'veggies' } }],
    }
    render(<ProfileRewardsPage />)
    expect(screen.getByText('Progression')).toBeInTheDocument()
  })

  it('?reward= ciblant un palier scrolle vers sa carte (deep-link picker/onboarding)', () => {
    vi.useFakeTimers()
    try {
      mockLogs = {
        statsLogs: [{ id: 1 }], cleanStatsLogs: [{ id: 1 }], streak: { current: 1, best: 1 },
        badges: [{ id: 'volume-1', theme: 'volume', tier: 1, threshold: 1, emoji: '🍳', label: { fr: 'Première recette', en: 'First' }, unlocked: false, isNextTier: true, progress: { current: 0, value: 0, threshold: 1 }, reward: { banner: 'veggies' } }],
      }
      mockCtx.profile = { unlocked_banners: [] }
      mockCtx.searchParams = new URLSearchParams('reward=volume-1')
      render(<ProfileRewardsPage />)
      const card = document.getElementById('badge-volume-1')
      expect(card).not.toBeNull()
      expect(card.style.animation).toBeTruthy() // clignote dès le rendu
      vi.advanceTimersByTime(200)
      expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('octroi automatique : palier terminé + bannière non prise → updateProfile + célébration', async () => {
    mockLogs = {
      statsLogs: [{ id: 1 }], cleanStatsLogs: [{ id: 1 }], streak: { current: 1, best: 1 },
      badges: [{ id: 'volume-1', theme: 'volume', tier: 1, threshold: 1, emoji: '🍳', label: { fr: 'Première recette', en: 'First' }, unlocked: true, isNextTier: false, progress: { current: 1, value: 1, threshold: 1 }, reward: { banner: 'veggies' } }],
    }
    mockCtx.profile = { unlocked_banners: [] }
    render(<ProfileRewardsPage />)
    await waitFor(() => expect(screen.getByText(/nouvelle bannière débloquée/i)).toBeInTheDocument())
  })
})
