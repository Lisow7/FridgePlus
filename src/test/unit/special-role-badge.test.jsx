import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SpecialRoleBadge from '@features/profile/components/special-role-badge'

describe('SpecialRoleBadge', () => {
  it('retourne null si role est null', () => {
    const { container } = render(<SpecialRoleBadge role={null} lang="fr" />)
    expect(container.firstChild).toBeNull()
  })

  it('affiche Bêta-testeur pour tester en FR', () => {
    render(<SpecialRoleBadge role="tester" lang="fr" />)
    expect(screen.getByText('Bêta-testeur')).toBeInTheDocument()
  })

  it('affiche Beta tester pour tester en EN', () => {
    render(<SpecialRoleBadge role="tester" lang="en" />)
    expect(screen.getByText('Beta tester')).toBeInTheDocument()
  })

  it('affiche Équipe support pour support en FR', () => {
    render(<SpecialRoleBadge role="support" lang="fr" />)
    expect(screen.getByText('Équipe support')).toBeInTheDocument()
  })

  it('affiche Créateur partenaire pour influencer en FR', () => {
    render(<SpecialRoleBadge role="influencer" lang="fr" />)
    expect(screen.getByText('Créateur partenaire')).toBeInTheDocument()
  })

  it('affiche Partenaire Fridge+ pour partner en FR', () => {
    render(<SpecialRoleBadge role="partner" lang="fr" />)
    expect(screen.getByText('Partenaire Fridge+')).toBeInTheDocument()
  })

  it('retourne null pour un rôle inconnu', () => {
    const { container } = render(<SpecialRoleBadge role="unknown" lang="fr" />)
    expect(container.firstChild).toBeNull()
  })
})
