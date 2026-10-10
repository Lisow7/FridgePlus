import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Décision du 2026-10-08 (audit du 2026-10-04, A11Y ; WCAG 2.5.7) : réordonner
// les étapes d'une recette ne doit pas exiger de glisser. Deux boutons ↑ ↓ sur
// chaque étape, à côté de la poignée, qui reste.

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, transition: null, isDragging: false }),
}))
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => undefined } } }))

import RecipeFormSortableStep from '@features/recipes/components/recipe-form-sortable-step'
import { FORM_I18N } from '@features/recipes/i18n/recipe-form-i18n'

const etape = { id: 's-2', text: 'Ajouter le riz' }
const monter = (props = {}) => render(
  <RecipeFormSortableStep step={etape} index={1} total={3} onChange={() => {}} onDelete={() => {}} onMove={() => {}}
    t={FORM_I18N.fr} lang="fr" {...props} />,
)

describe('réordonner une étape sans glisser', () => {
  it('deux boutons nommés par le numéro de l’étape, à côté de la poignée qui reste', () => {
    monter()
    expect(screen.getByRole('button', { name: 'Monter l\'étape 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Descendre l\'étape 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Déplacer l\'étape' })).toBeInTheDocument()
  })

  it('« Monter » remonte l’étape d’un rang, « Descendre » la descend', () => {
    const onMove = vi.fn()
    monter({ onMove })
    fireEvent.click(screen.getByRole('button', { name: 'Monter l\'étape 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descendre l\'étape 2' }))
    expect(onMove.mock.calls).toEqual([['s-2', -1], ['s-2', 1]])
  })

  it('la première ne monte pas, la dernière ne descend pas', () => {
    const { unmount } = monter({ index: 0 })
    expect(screen.getByRole('button', { name: 'Monter l\'étape 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descendre l\'étape 1' })).toBeEnabled()
    unmount()
    monter({ index: 2 })
    expect(screen.getByRole('button', { name: 'Descendre l\'étape 3' })).toBeDisabled()
  })

  it('en anglais aussi', () => {
    monter({ t: FORM_I18N.en, lang: 'en' })
    expect(screen.getByRole('button', { name: 'Move up step 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move down step 2' })).toBeInTheDocument()
  })
})
