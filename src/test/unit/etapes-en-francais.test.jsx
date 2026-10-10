import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'

// Audit du 2026-10-04, lot 9g-1 (A11Y-20 (1) et (2)) : dans « Créer une recette », un
// francophone entendait « Drag step », « Delete step », « Start voice », et les annonces
// du glisser venaient de dnd-kit en anglais (« Picked up draggable item s-k3x… »).

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, transition: null, isDragging: false }),
}))
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => undefined } } }))

import RecipeFormSortableStep from '@features/recipes/components/recipe-form-sortable-step'
import { FORM_I18N } from '@features/recipes/i18n/recipe-form-i18n'
import { annoncesDuGlisser, INSTRUCTIONS_DU_GLISSER } from '@features/recipes/lib/annonces-du-glisser'

const etape = { id: 's-1', text: 'Faire revenir l’oignon' }

describe('les boutons d’une étape ont un nom dans la langue de la personne', () => {
  it('en français : la poignée et la suppression', () => {
    render(<RecipeFormSortableStep step={etape} index={0} onChange={() => {}} onDelete={() => {}} t={FORM_I18N.fr} lang="fr" />)
    expect(screen.getByRole('button', { name: 'Déplacer l\'étape' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer l\'étape' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Drag step|Delete step/ })).not.toBeInTheDocument()
  })

  it('en anglais aussi', () => {
    render(<RecipeFormSortableStep step={etape} index={0} onChange={() => {}} onDelete={() => {}} t={FORM_I18N.en} lang="en" />)
    expect(screen.getByRole('button', { name: 'Move step' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete step' })).toBeInTheDocument()
  })

  it('le dictionnaire des membres porte les quatre noms, dans les deux langues (plus de repli anglais dans le composant)', () => {
    for (const lang of ['fr', 'en']) for (const cle of ['dragStep', 'deleteStep', 'startMic', 'stopMic']) {
      expect(FORM_I18N[lang][cle], `${lang}.${cle}`).toBeTruthy()
    }
    const source = readFileSync('src/features/recipes/components/recipe-form-sortable-step.jsx', 'utf8')
    expect(source).not.toMatch(/\?\? '(Drag step|Delete step|Start voice|Stop voice)'/)
  })
})

describe('les annonces du glisser parlent la langue de la personne', () => {
  // La position de chaque étape, telle que la liste l'affiche (1 = la première).
  const position = (id) => ({ 's-a': 1, 's-b': 2, 's-c': 3 })[id] ?? null
  const fr = annoncesDuGlisser('fr', position)
  const en = annoncesDuGlisser('en', position)

  it('saisir, survoler, déposer, annuler — en français, par numéro d’étape', () => {
    expect(fr.onDragStart({ active: { id: 's-b' } })).toBe('Étape 2 saisie.')
    expect(fr.onDragOver({ active: { id: 's-b' }, over: { id: 's-c' } })).toBe('Étape 2 sur la position 3.')
    expect(fr.onDragOver({ active: { id: 's-b' }, over: null })).toBe('Étape 2 hors de la liste.')
    expect(fr.onDragEnd({ active: { id: 's-b' }, over: { id: 's-c' } })).toBe('Étape 2 déposée en position 3.')
    expect(fr.onDragEnd({ active: { id: 's-b' }, over: null })).toBe('Étape 2 reposée à sa place.')
    expect(fr.onDragCancel({ active: { id: 's-b' } })).toBe('Déplacement annulé : l\'étape 2 reste à sa place.')
  })

  it('en anglais aussi, et la consigne lue au focus de la poignée existe dans les deux langues', () => {
    expect(en.onDragStart({ active: { id: 's-a' } })).toBe('Step 1 picked up.')
    expect(en.onDragEnd({ active: { id: 's-a' }, over: { id: 's-c' } })).toBe('Step 1 dropped at position 3.')
    expect(INSTRUCTIONS_DU_GLISSER.fr.draggable).toMatch(/Espace/)
    expect(INSTRUCTIONS_DU_GLISSER.en.draggable).toMatch(/space bar/i)
  })

  it('le formulaire des membres les branche sur son DndContext', () => {
    const source = readFileSync('src/features/recipes/components/recipe-form-modal.jsx', 'utf8')
    expect(source).toMatch(/annonces-du-glisser/)
    expect(source).toMatch(/<DndContext[^>]*accessibility=/)
  })
})
