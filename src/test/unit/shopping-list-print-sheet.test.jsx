import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShoppingListPrintSheet from '@features/cart/components/shopping-list-print-sheet'
import CartShareSheet from '@features/cart/components/cart-share-sheet'

// Liste de courses imprimable. Remplace `buildAisleListHtml`, frère de la fiche
// recette : même chaîne HTML assemblée à la main, même fenêtre `blob:`, même
// `<script>` en ligne bloqué par la CSP de production (audit 2026-10-04).
const printSpy = vi.fn()
vi.mock('@shared/lib/print/print-element', () => ({ printReactElement: (...a) => printSpy(...a) }))
vi.mock('@features/cart/api/shared-baskets', () => ({ createSharedBasket: vi.fn() }))

const rows = [
  { label: 'Tomates', aisle: 'produce', amount: 3, unit: 'pcs' },
  { label: 'Courgette', aisle: 'produce', amount: 1, unit: 'pcs' },
  { label: 'Beurre doux', aisle: 'dairy', amount: 250, unit: 'g' },
  { label: 'Sel', aisle: 'condiments' },
]

describe('ShoppingListPrintSheet', () => {
  it('range les articles par rayon, dans l’ordre du magasin, avec leur nombre', () => {
    render(<ShoppingListPrintSheet shareRows={rows} total={0} lang="fr" />)
    const rayons = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(rayons).toHaveLength(3)
    expect(rayons[0]).toContain('Fruits & Légumes')
    expect(rayons[0]).toContain('2')
    expect(rayons[1]).toContain('Crèmerie & Œufs')
    expect(rayons[2]).toContain('Condiments & Épices')
  })

  it('affiche la quantité quand elle existe, rien sinon', () => {
    const { container } = render(<ShoppingListPrintSheet shareRows={rows} total={0} lang="fr" />)
    expect(container.textContent).toContain('250 g')
    const sel = screen.getByText('Sel').closest('li')
    expect(sel.textContent).toBe('Sel')
  })

  it('affiche le total estimé avec une virgule quand il est positif', () => {
    const { container } = render(<ShoppingListPrintSheet shareRows={rows} total={12.5} lang="fr" />)
    expect(container.textContent).toContain('Total estimé')
    expect(container.textContent).toContain('12,50 €')
  })

  it('n’affiche pas de total à zéro', () => {
    const { container } = render(<ShoppingListPrintSheet shareRows={rows} total={0} lang="fr" />)
    expect(container.textContent).not.toContain('Total estimé')
  })

  it('dit que la liste est vide plutôt que d’imprimer une page blanche', () => {
    const { container } = render(<ShoppingListPrintSheet shareRows={[]} total={0} lang="fr" />)
    expect(container.textContent).toContain('Liste vide')
  })

  it('rend un libellé piégé comme du TEXTE', () => {
    const piege = '<img src=x onerror=alert(1)>'
    const { container } = render(
      <ShoppingListPrintSheet shareRows={[{ label: piege, aisle: 'other' }]} total={0} lang="fr" />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain(piege)
  })
})

describe('CartShareSheet — Imprimer', () => {
  it('imprime la liste par la racine d’impression, sans fenêtre ni blob', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const onClose = vi.fn()
    render(<CartShareSheet open lang="fr" onClose={onClose} userId={null} shareRows={rows} shareTotal={7} />)
    fireEvent.click(screen.getByRole('button', { name: 'Imprimer' }))
    expect(open).not.toHaveBeenCalled()
    expect(printSpy).toHaveBeenCalledOnce()
    const element = printSpy.mock.calls[0][0]
    expect(element.type).toBe(ShoppingListPrintSheet)
    expect(element.props).toMatchObject({ shareRows: rows, total: 7, lang: 'fr' })
    expect(onClose).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
