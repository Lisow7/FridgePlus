// Régression (QA live prod du 2026-07-27) — l'onglet Qualité affichait
// « Qualité parfaite · Recettes 100 % » alors que la requête `recipe_health_check`
// échouait en 400 : `adminGetHealthChecks()` renvoyait bien `error`, mais le
// composant ne le déstructurait pas. Résultat : listes vides → score 100 %.
//
// Un écran d'audit qui affirme « tout va bien » alors qu'il n'a rien pu lire est
// plus dangereux que le même écran en panne : on cesse de chercher le problème.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const { mockGetHealthChecks } = vi.hoisted(() => ({ mockGetHealthChecks: vi.fn() }))
vi.mock('@features/admin/api/admin', () => ({
  adminGetHealthChecks: (...args) => mockGetHealthChecks(...args),
}))
vi.mock('./import-queue-tab', () => ({ default: () => null }))
vi.mock('@features/admin/components/sections/import-queue-tab', () => ({ default: () => null }))

import DataQualitySection from '@features/admin/components/sections/data-quality-section'

beforeEach(() => { mockGetHealthChecks.mockReset() })

describe('DataQualitySection — échec de chargement', () => {
  it('n’annonce PAS « Qualité parfaite » quand la requête a échoué', async () => {
    // Cas réel : la vue SQL plante → aucune ligne remontée, mais les totaux, eux,
    // proviennent d'une autre requête qui a réussi → l'ancien calcul donnait 100 %.
    mockGetHealthChecks.mockResolvedValue({
      recipes: [], ingredients: [], totalRecipes: 515, totalIngredients: 653,
      error: { code: '22023', message: 'cannot extract elements from an object' },
    })

    render(<DataQualitySection />)

    await waitFor(() => expect(mockGetHealthChecks).toHaveBeenCalled())

    expect(screen.queryByText('Qualité parfaite')).not.toBeInTheDocument()
    expect(screen.queryByText(/100\s*%/)).not.toBeInTheDocument()
  })

  it('signale explicitement l’échec de l’analyse', async () => {
    mockGetHealthChecks.mockResolvedValue({
      recipes: [], ingredients: [], totalRecipes: 515, totalIngredients: 653,
      error: { code: '22023', message: 'cannot extract elements from an object' },
    })

    render(<DataQualitySection />)

    expect(await screen.findByText(/analyse impossible/i)).toBeInTheDocument()
  })

  it('affiche « Qualité parfaite » quand l’analyse réussit sans problème', async () => {
    mockGetHealthChecks.mockResolvedValue({
      recipes: [], ingredients: [], totalRecipes: 515, totalIngredients: 653,
      error: null,
    })

    render(<DataQualitySection />)

    expect(await screen.findByText('Qualité parfaite')).toBeInTheDocument()
    expect(screen.queryByText(/analyse impossible/i)).not.toBeInTheDocument()
  })
})
