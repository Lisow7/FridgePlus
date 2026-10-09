import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthLayout from '@features/auth/components/auth-layout'

describe('AuthLayout — branding', () => {
  it('le titre rend exactement « Fridge+ » (pas « Fridge++ »)', () => {
    render(<AuthLayout lang="fr"><div /></AuthLayout>)
    const h1 = screen.getByRole('heading', { level: 1 })
    // textContent strict : « Fridge » + « + » = « Fridge+ » (le bug donnait « Fridge++ »)
    expect(h1.textContent).toBe('Fridge+')
  })

  it('idem en anglais', () => {
    render(<AuthLayout lang="en"><div /></AuthLayout>)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Fridge+')
  })
})

// Audit du 2026-10-04, CPT-13 : aucun lien d'aide sur les pages de connexion,
// alors que le support intégré à l'app demande justement d'être connecté.
describe('AuthLayout — aide', () => {
  it('donne toujours un moyen d’écrire au support', () => {
    render(<AuthLayout lang="fr"><div /></AuthLayout>)
    const lien = screen.getByRole('link', { name: /support@fridgeplus\.app/ })
    expect(lien).toHaveAttribute('href', 'mailto:support@fridgeplus.app')
    expect(screen.getByText(/un souci pour te connecter/i)).toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    render(<AuthLayout lang="en"><div /></AuthLayout>)
    expect(screen.getByRole('link', { name: /support@fridgeplus\.app/ })).toHaveAttribute('href', 'mailto:support@fridgeplus.app')
    expect(screen.getByText(/trouble signing in/i)).toBeInTheDocument()
  })

  it('reste là quand la page fournit son propre pied (lien « Créer un compte »)', () => {
    render(<AuthLayout lang="fr" footer={<span>Pas encore de compte ?</span>}><div /></AuthLayout>)
    expect(screen.getByText(/pas encore de compte/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /support@fridgeplus\.app/ })).toBeInTheDocument()
  })
})
