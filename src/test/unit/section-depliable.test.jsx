import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProfileSection from '@features/profile/components/profile-section'

// Audit du 2026-10-04, A11Y-19 : le garde-fou axe connecté a relevé sur
// « Compte & sécurité » un `<header role="button">` qui CONTENAIT le titre
// (`aria-allowed-role` ; un bouton aplatit le titre qu'il contient — le plan
// des titres le perdait). Le motif d'une section dépliable : `<h2><button
// aria-expanded>Titre</button></h2>`.

describe('section dépliable du profil', () => {
  it('le titre reste un titre de niveau 2, et c’est un vrai bouton qui déplie', () => {
    render(<ProfileSection title="Confidentialité" description="Tes données" collapsible defaultOpen={false}><p>Contenu</p></ProfileSection>)
    const titre = screen.getByRole('heading', { level: 2, name: 'Confidentialité' })
    const bouton = screen.getByRole('button', { name: 'Confidentialité' })
    expect(titre).toContainElement(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Contenu')).not.toBeInTheDocument()
  })

  it('le bouton déplie et replie (une fois par clic, pas deux)', () => {
    render(<ProfileSection title="Confidentialité" collapsible defaultOpen={false}><p>Contenu</p></ProfileSection>)
    const bouton = screen.getByRole('button', { name: 'Confidentialité' })
    fireEvent.click(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Contenu')).toBeInTheDocument()
    fireEvent.click(bouton)
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
  })

  it('aucun élément ne joue le bouton à la place d’un bouton', () => {
    const { container } = render(<ProfileSection title="Confidentialité" collapsible><p>Contenu</p></ProfileSection>)
    expect(container.querySelector('[role="button"]')).toBeNull()
  })

  it('non dépliable : un titre, aucun bouton', () => {
    render(<ProfileSection title="Préférences"><p>Contenu</p></ProfileSection>)
    expect(screen.getByRole('heading', { level: 2, name: 'Préférences' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
