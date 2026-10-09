import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockFetch, mockSet } = vi.hoisted(() => ({ mockFetch: vi.fn(), mockSet: vi.fn() }))
vi.mock('@shared/api/feature-flags', () => ({
  // Le panneau lit les drapeaux avec leur erreur (audit ADM-08) : { data, error }.
  loadFeatureFlags: mockFetch,
  setFeatureFlag: mockSet,
}))
vi.mock('@shared/contexts/feature-flags-provider', () => ({
  useFeatureFlags: () => ({ reload: vi.fn() }),
}))
// La bascule se confirme (ADM-04) : prouvé avec le vrai fournisseur dans
// `admin-gestes-confirmes.test.jsx` ; ici, seul le regroupement est en jeu.
vi.mock('@shared/ui/confirm-dialog/confirm-provider', () => ({ useConfirm: () => async () => true }))

import FeaturesSection from '@features/admin/components/sections/features-section'

describe('FeaturesSection — regroupement production / prévues', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockSet.mockReset()
  })

  it('sépare les flags branchés en code (production) des flags orphelins (prévus, non développés)', async () => {
    mockFetch.mockResolvedValue({ error: null, data: [
      { key: 'onboarding_activation', enabled: true, label: 'Carte « Bien démarrer »', description: 'desc' },
      { key: 'community_rails', enabled: false, label: 'Rails communauté', description: 'Follow + capture (fast-follow).' },
    ] })
    render(<FeaturesSection lang="fr" />)

    await waitFor(() => expect(screen.getByText('Carte « Bien démarrer »')).toBeInTheDocument())

    expect(screen.getByText('En production')).toBeInTheDocument()
    expect(screen.getByText('Prévues — pas encore développées')).toBeInTheDocument()
  })

  it('affiche un avertissement uniquement sur un flag orphelin (aucun code ne le consomme)', async () => {
    mockFetch.mockResolvedValue({ error: null, data: [
      { key: 'onboarding_activation', enabled: true, label: 'Carte « Bien démarrer »', description: 'desc' },
      { key: 'community_rails', enabled: false, label: 'Rails communauté', description: 'Follow + capture (fast-follow).' },
    ] })
    render(<FeaturesSection lang="fr" />)

    await waitFor(() => expect(screen.getByText('Rails communauté')).toBeInTheDocument())

    expect(screen.getByText(/aucun code ne lit ce flag/i)).toBeInTheDocument()
    expect(screen.queryByText('Carte « Bien démarrer »').closest('div').textContent).not.toMatch(/aucun code ne lit ce flag/i)
  })

  it('sans flag orphelin, aucune section "Prévues" ne s\'affiche', async () => {
    mockFetch.mockResolvedValue({ error: null, data: [
      { key: 'onboarding_activation', enabled: true, label: 'Carte « Bien démarrer »', description: 'desc' },
    ] })
    render(<FeaturesSection lang="fr" />)

    await waitFor(() => expect(screen.getByText('Carte « Bien démarrer »')).toBeInTheDocument())
    expect(screen.queryByText('Prévues — pas encore développées')).not.toBeInTheDocument()
  })
})
