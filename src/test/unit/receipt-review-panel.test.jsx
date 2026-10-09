import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@shared/contexts/data-provider', () => ({
  useIngredients: () => ({
    vegetables: [{ id: 'vg-tomate', labels: { fr: 'Tomate' }, emoji: '🍅' }],
  }),
}))

const { default: ReceiptReviewPanel } = await import('../../features/receipt-scan/components/receipt-review-panel.jsx')

describe('ReceiptReviewPanel', () => {
  it('affiche les ingrédients matchés, pré-cochés, sans texte brut du ticket', () => {
    render(
      <ReceiptReviewPanel
        lang="fr"
        matched={[{ id: 'vg-tomate', labels: { fr: 'Tomate' }, emoji: '🍅' }]}
        ambiguous={[]}
        unmatchedCount={0}
        stock={new Set()}
        onAdd={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/Tomate/)).toBeInTheDocument()
  })

  it('affiche un resume du nombre d\'articles non reconnus, sans jamais citer le texte brut', () => {
    render(
      <ReceiptReviewPanel
        lang="fr" matched={[]} ambiguous={[]} unmatchedCount={2}
        stock={new Set()} onAdd={() => {}} onCancel={() => {}}
      />
    )
    expect(screen.getByText(/2 articles non reconnus/)).toBeInTheDocument()
  })

  it('affiche les candidats ambigus, un choix les résout en item matché', () => {
    render(
      <ReceiptReviewPanel
        lang="fr" matched={[]}
        ambiguous={[{ candidates: [
          { id: 'fr-jambon-blanc', labels: { fr: 'Jambon blanc' } },
          { id: 'fr-jambon-cru', labels: { fr: 'Jambon cru' } },
        ] }]}
        unmatchedCount={0} stock={new Set()} onAdd={() => {}} onCancel={() => {}}
      />
    )
    fireEvent.click(screen.getByText('Jambon blanc'))
    expect(screen.queryByText('Jambon cru')).not.toBeInTheDocument()
    expect(screen.getByText('Jambon blanc')).toBeInTheDocument()
  })

  it('ne montre pas un ingrédient en double s\'il est à la fois matché et candidat ambigu résolu', () => {
    render(
      <ReceiptReviewPanel
        lang="fr"
        matched={[{ id: 'fr-jambon-blanc', labels: { fr: 'Jambon blanc' }, emoji: '🍖' }]}
        ambiguous={[{ candidates: [
          { id: 'fr-jambon-blanc', labels: { fr: 'Jambon blanc' } },
          { id: 'fr-jambon-cru', labels: { fr: 'Jambon cru' } },
        ] }]}
        unmatchedCount={0} stock={new Set()} onAdd={() => {}} onCancel={() => {}}
      />
    )
    // Avant résolution : le libellé apparaît deux fois (candidat ambigu + item déjà matché, avec emoji)
    expect(screen.getAllByText(/Jambon blanc/)).toHaveLength(2)
    // Le candidat ambigu est rendu avant la liste des items matchés dans le DOM
    fireEvent.click(screen.getAllByText(/Jambon blanc/)[0])
    expect(screen.getAllByText(/Jambon blanc/)).toHaveLength(1)
  })

  it('le bouton "Ajouter au frigo" appelle onAdd avec les ids cochés uniquement', () => {
    const onAdd = vi.fn()
    render(
      <ReceiptReviewPanel
        lang="fr"
        matched={[{ id: 'vg-tomate', labels: { fr: 'Tomate' }, emoji: '🍅' }]}
        ambiguous={[]} unmatchedCount={0}
        stock={new Set()} onAdd={onAdd} onCancel={() => {}}
      />
    )
    fireEvent.click(screen.getByText(/Ajouter au frigo/))
    expect(onAdd).toHaveBeenCalledWith(['vg-tomate'])
  })
})
