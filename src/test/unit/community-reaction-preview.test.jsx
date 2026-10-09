// Tests unit — EmojiReactionBar + RecipePreviewCard, feuilles extraites de
// community-page.jsx (audit front §2).

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmojiReactionBar } from '@features/community/components/community-emoji-reaction-bar'
import { RecipePreviewCard } from '@features/community/components/community-recipe-preview-card'

describe('EmojiReactionBar', () => {
  it('affiche l\'emoji de ma réaction et le compteur', () => {
    render(<EmojiReactionBar myReaction="🔥" totalCount={5} canReact onReact={() => {}} darkMode={false} />)
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('re-clic sur le trigger avec une réaction existante appelle onReact (toggle off)', () => {
    const onReact = vi.fn()
    render(<EmojiReactionBar myReaction="🔥" totalCount={5} canReact onReact={onReact} darkMode={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onReact).toHaveBeenCalledWith('🔥')
  })

  it('est désactivé quand canReact=false', () => {
    render(<EmojiReactionBar myReaction={null} totalCount={0} canReact={false} disabledReason="Muté" onReact={() => {}} darkMode={false} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('RecipePreviewCard', () => {
  it('affiche le nom résolu et navigue au clic', () => {
    const onShowRecipe = vi.fn()
    render(<RecipePreviewCard recipeId="r1" recipeNames={{ r1: { fr: 'Tarte' } }} lang="fr" darkMode={false} onShowRecipe={onShowRecipe} />)
    expect(screen.getByText('Tarte')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Tarte'))
    expect(onShowRecipe).toHaveBeenCalledWith('r1')
  })

  it('affiche un label fallback quand le nom n\'est pas résolu', () => {
    render(<RecipePreviewCard recipeId="r1" recipeNames={{}} lang="fr" darkMode={false} onShowRecipe={() => {}} />)
    expect(screen.getByText('Voir la recette')).toBeInTheDocument()
  })
})
