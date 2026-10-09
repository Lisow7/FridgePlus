import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@shared/lib/premium-config', () => ({ PREMIUM_ENABLED: false }))
vi.mock('@shared/contexts/recipe-form-context', () => ({ useRecipeForm: () => ({ openCreate: () => {} }) }))
const mockFlags = vi.hoisted(() => ({ receiptScan: false }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => mockFlags.receiptScan }))

import HelpGuide from '@features/onboarding/components/help-guide'

const renderHelp = (props = {}) =>
  render(<MemoryRouter><HelpGuide lang="fr" defaultOpen {...props} /></MemoryRouter>)

describe('HelpGuide — hub d’aide (refonte)', () => {
  it('structure minimale : accès au guide + explorer replié + lien FAQ', () => {
    renderHelp()
    expect(screen.getByText('Comment ça marche')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explorer les fonctionnalités' })).toBeInTheDocument()
    // La FAQ n'est plus dépliée ici : c'est un lien vers la page `/faq`.
    expect(screen.getByRole('button', { name: /Questions fréquentes/ })).toBeInTheDocument()
    // Explorer replié : les fonctionnalités ne sont pas visibles d’emblée
    expect(screen.queryByText('Le frigo')).not.toBeInTheDocument()
  })

  it('Explorer déplié : groupes + badges d’accès', () => {
    renderHelp()
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    expect(screen.getByText('Le frigo')).toBeInTheDocument()
    expect(screen.getByText('Panier')).toBeInTheDocument()
    expect(screen.getAllByText('Compte').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bientôt').length).toBeGreaterThan(0)
  })

  it('CTA invité : gratuit → Y aller, profil (bloqué) → Créer un compte, soon → Voir ce qui arrive', () => {
    renderHelp({ user: null, onShowRecipes: () => {} })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    fireEvent.click(screen.getByRole('button', { name: /Les recettes/ }))
    expect(screen.getByText(/^Y aller/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Profil/ }))
    expect(screen.getByText(/^Créer un compte/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Panier/ }))
    expect(screen.getByText(/^Voir ce qui arrive/)).toBeInTheDocument()
  })

  it('CTA invité : « Créer une recette » reste accessible (création libre → Y aller)', () => {
    renderHelp({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    fireEvent.click(screen.getByRole('button', { name: /Créer une recette/ }))
    expect(screen.getByText(/^Y aller/)).toBeInTheDocument()
    expect(screen.queryByText(/^Créer un compte/)).not.toBeInTheDocument()
  })

  it('CTA connecté : Profil → Y aller (pas de « Créer un compte »)', () => {
    renderHelp({ user: { id: 'u1' }, onShowProfile: () => {} })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    fireEvent.click(screen.getByRole('button', { name: /Profil/ }))
    expect(screen.getByText(/^Y aller/)).toBeInTheDocument()
    expect(screen.queryByText(/^Créer un compte/)).not.toBeInTheDocument()
  })

  // Chantier H (2026-07-09) : « Aperçu du frigo » (pilule inventaire déplacée
  // en D) et « Scan du ticket de caisse » ajoutés à l'Explorer.
  it('« Aperçu du frigo » listée (gratuit), CTA ramène juste à l’accueil', () => {
    renderHelp({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    fireEvent.click(screen.getByRole('button', { name: /Aperçu du frigo/ }))
    expect(screen.getByText(/^Y aller/)).toBeInTheDocument()
  })

  it('« Scan du ticket de caisse » absente quand le flag receipt_scan est désactivé', () => {
    mockFlags.receiptScan = false
    renderHelp()
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    expect(screen.queryByText('Scan du ticket de caisse')).not.toBeInTheDocument()
  })

  it('« Scan du ticket de caisse » présente + bloquée invité (compte requis) quand le flag est actif', () => {
    mockFlags.receiptScan = true
    renderHelp({ user: null })
    fireEvent.click(screen.getByRole('button', { name: 'Explorer les fonctionnalités' }))
    fireEvent.click(screen.getByRole('button', { name: /Scan du ticket de caisse/ }))
    expect(screen.getByText(/^Créer un compte/)).toBeInTheDocument()
    mockFlags.receiptScan = false
  })
})
