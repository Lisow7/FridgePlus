import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GettingStartedCard from '@features/onboarding/components/getting-started-card'

const base = { lang: 'fr', isGuest: true, stepsTotal: 2, stepsDone: 0, onCollapse: () => {} }

describe('GettingStartedCard (coach)', () => {
  it('s1 : puces + Tout ajouter, appelle onQuickAdd', () => {
    const onQuickAdd = vi.fn()
    render(<GettingStartedCard {...base} state="s1" onQuickAdd={onQuickAdd} />)
    expect(screen.getByText('On cuisine ?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tout ajouter' }))
    expect(onQuickAdd).toHaveBeenCalled()
  })
  it('s2a : nomme la recette + CTA Voir la recette', () => {
    const onSeeRecipe = vi.fn()
    render(<GettingStartedCard {...base} stepsDone={1} state="s2a" recipeName="Carbonara" onSeeRecipe={onSeeRecipe} />)
    expect(screen.getByText(/Carbonara/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Voir la recette/ }))
    expect(onSeeRecipe).toHaveBeenCalledOnce()
  })
  it('s2b : « Presque » + Voir les recettes', () => {
    const onSeeRecipes = vi.fn()
    render(<GettingStartedCard {...base} stepsDone={1} state="s2b" onSeeRecipes={onSeeRecipes} />)
    expect(screen.getByText('Presque !')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Voir les recettes/ }))
    expect(onSeeRecipes).toHaveBeenCalledOnce()
  })
  it('s2b : « Tout ajouter » et « Voir les recettes » côte à côte, pas empilés (chantier H)', () => {
    const onQuickAdd = vi.fn()
    render(<GettingStartedCard {...base} stepsDone={1} state="s2b" onQuickAdd={onQuickAdd} onSeeRecipes={() => {}} />)
    const addAllBtn = screen.getByRole('button', { name: 'Tout ajouter' })
    const seeRecipesBtn = screen.getByRole('button', { name: /Voir les recettes/ })
    expect(addAllBtn.parentElement).toBe(seeRecipesBtn.parentElement)
    expect(addAllBtn.parentElement).toHaveClass('flex')
    fireEvent.click(addAllBtn)
    expect(onQuickAdd).toHaveBeenCalled()
  })
  it('s3 (connecté) : Plus qu’à cuisiner', () => {
    render(<GettingStartedCard {...base} isGuest={false} stepsTotal={3} stepsDone={2} state="s3" onSeeRecipes={() => {}} />)
    expect(screen.getByText('Plus qu’à cuisiner !')).toBeInTheDocument()
  })
  it('fin invité : bloc inscription, CTA onSignUp', () => {
    const onSignUp = vi.fn()
    render(<GettingStartedCard {...base} state="fin" onSignUp={onSignUp} />)
    expect(screen.getByText('🎉 Et voilà !')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Créer mon compte/ }))
    expect(onSignUp).toHaveBeenCalledOnce()
  })
  it('fin connecté : Bravo + Voir mes récompenses', () => {
    const onOpenRewards = vi.fn()
    render(<GettingStartedCard {...base} isGuest={false} stepsTotal={3} stepsDone={3} state="fin" onOpenRewards={onOpenRewards} />)
    expect(screen.getByText('🎉 Bravo !')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Voir mes récompenses/ }))
    expect(onOpenRewards).toHaveBeenCalledOnce()
  })
  it('réduite (masquée) : ne rend rien — le point d’entrée vit dans le footer', () => {
    render(<GettingStartedCard {...base} state="s1" collapsed />)
    expect(screen.queryByText('On cuisine ?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('appelle onCollapse au clic ✕', () => {
    const onCollapse = vi.fn()
    render(<GettingStartedCard {...base} state="s1" onCollapse={onCollapse} />)
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }))
    expect(onCollapse).toHaveBeenCalledOnce()
  })

  // Spec « aide & bouton orange » (2026-09-11), § 4.1 : l'état vide est le
  // moment d'enseigner l'action principale — les trois façons de remplir, avec
  // les icônes du menu, et le bouton orange reconnu par son glyphe.
  it('s1 : nomme les quatre façons de remplir avec leurs icônes et le glyphe du bouton orange', () => {
    render(<GettingStartedCard {...base} state="s1" />)
    expect(screen.getByText('Coche')).toBeInTheDocument()
    expect(screen.getByText('Cherche')).toBeInTheDocument()
    expect(screen.getByText('À la voix')).toBeInTheDocument()
    expect(screen.getByText('Photographie ton ticket')).toBeInTheDocument()
    expect(screen.getByText(/bouton orange/)).toBeInTheDocument()
    expect(document.querySelector('[data-fab-glyph]')).not.toBeNull()
    expect(document.querySelectorAll('[data-ways] li svg').length).toBe(4)
  })
})
