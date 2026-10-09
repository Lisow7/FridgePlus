import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockStock = vi.hoisted(() => ({ current: new Set() }))
const mockToggle = vi.hoisted(() => vi.fn())
const mockUndo = vi.hoisted(() => vi.fn())

const CATALOG = vi.hoisted(() => ([
  { id: 'fr-yaourt', labels: { fr: 'Yaourt nature' }, emoji: '🥛' },
  { id: 'fr-creme', labels: { fr: 'Crème fraîche' }, emoji: '🥛' },
  { id: 'vg-carotte', labels: { fr: 'Carottes' }, emoji: '🥕' },
  { id: 'gp-riz', labels: { fr: 'Riz basmati' }, emoji: '🍚' },
  { id: 'fr-poulet', labels: { fr: 'Poulet' }, emoji: '🍗' },
  { id: 'fr-cordon', labels: { fr: 'Cordon bleu' }, emoji: '🍗' },
  // Sous-catégorie réelle sans filtre dédié (cf. décision utilisateur
  // 2026-07-11) : doit rester visible même filtre actif.
  { id: 'gp-tofu', labels: { fr: 'Tofu nature' }, emoji: '🧈' },
  // Catégorie parente — jamais stockable directement (cf. sélecteur de
  // sous-catégorie) : ne doit jamais apparaître dans les résultats.
  { id: 'fr-fromage-parent', labels: { fr: 'Fromage' }, emoji: '🧀' },
  { id: 'fr-comte', labels: { fr: 'Comté' }, emoji: '🧀', group_id: 'fr-fromage-parent' },
]))

// Sous-catégories réelles (colonne `subcategory` en BDD) — indépendantes du
// préfixe d'id grossier, cf. CATEGORY_FILTERS dans inventory-panel.jsx.
// 'comte' -> 'cheese' (pas 'bof', qui n'est qu'un libellé d'affichage —
// cf. bug corrigé le 2026-07-11 : le filtre BOF ne matchait aucun vrai
// produit). 'gp-tofu' -> 'tofu', volontairement absent de tout filtre.
const SUBCATS = vi.hoisted(() => ({
  'gp-riz': 'pasta-rice',
  'vg-carotte': 'vegetables',
  'fr-poulet': 'meat',
  'fr-cordon': 'meat',
  'fr-comte': 'cheese',
  'gp-tofu': 'tofu',
}))

vi.mock('@shared/contexts/session-state-context', () => ({
  useStockSession: () => ({ stock: mockStock.current, toggleIngredient: mockToggle }),
}))
vi.mock('@shared/contexts/undo-provider', () => ({
  useUndo: () => ({ trigger: mockUndo }),
}))
vi.mock('@shared/contexts/data-provider', () => ({
  useIngredientsById: () => new Map(CATALOG.map((i) => [i.id, i])),
  useIngredientLookup: () => ({ getSubCategory: (id) => SUBCATS[id] ?? null }),
}))

import InventoryPanel from '@features/fridge/components/inventory-panel'

beforeEach(() => {
  mockStock.current = new Set(['fr-yaourt', 'vg-carotte'])
  mockToggle.mockClear()
  mockUndo.mockClear()
})

describe('InventoryPanel', () => {
  it('mode parcours (barre vide) : affiche uniquement ce qui est deja au frigo, groupe par zone', () => {
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    expect(screen.getByText('Yaourt nature')).toBeInTheDocument()
    expect(screen.getByText('Carottes')).toBeInTheDocument()
    expect(screen.queryByText('Crème fraîche')).not.toBeInTheDocument()
    expect(screen.queryByText('Riz basmati')).not.toBeInTheDocument()
  })

  it('recherche insensible aux accents : "creme" trouve "Crème fraîche" meme si pas encore au frigo', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'creme')
    expect(screen.getByText('Crème fraîche')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter Crème fraîche' })).toBeInTheDocument()
  })

  // Un parent (group_id) n'est jamais stockable : il n'apparaît pas. Mais
  // depuis le 2026-10-02, chercher la famille propose ses enfants (« pâtes »
  // ne trouvait rien alors que Spaghetti, Penne… sont dans le catalogue).
  it('ne montre jamais un parent, mais chercher la famille propose ses enfants', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'fromage')
    expect(screen.queryByText('Fromage')).not.toBeInTheDocument()
    expect(screen.getByText('Comté')).toBeInTheDocument()
  })

  it('cherche en début de mot, pas au milieu (« oeuf » ne doit pas ramener « bœuf »)', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'ou')
    expect(screen.queryByText('Yaourt nature')).not.toBeInTheDocument()
    expect(screen.getByText('Aucun aliment ne correspond à « ou ».')).toBeInTheDocument()
  })

  // P5 (audit 2026-10-02) : « Retirer » était une coche orange de 22 px — une
  // coche se lit « je l'ai », pas « enlever » — et le retrait était sans retour.
  it('retirer passe par une poubelle nommée, assez grande pour le doigt', () => {
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    const bouton = screen.getByRole('button', { name: 'Retirer Yaourt nature' })
    expect(bouton.querySelector('svg')).not.toBeNull()
    expect(bouton.textContent).not.toContain('✓')
    expect(parseInt(bouton.style.width, 10)).toBeGreaterThanOrEqual(40)
    expect(parseInt(bouton.style.height, 10)).toBeGreaterThanOrEqual(40)
  })

  it('retirer propose « Annuler », et annuler remet l’aliment', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Retirer Yaourt nature' }))
    expect(mockToggle).toHaveBeenCalledTimes(1)
    expect(mockUndo).toHaveBeenCalledTimes(1)
    const { label, onUndo } = mockUndo.mock.calls[0][0]
    expect(label).toBe('Yaourt nature retiré')
    mockStock.current.delete('fr-yaourt') // ce que fait le vrai retrait
    onUndo()
    expect(mockToggle).toHaveBeenCalledTimes(2)
    expect(mockToggle).toHaveBeenLastCalledWith('fr-yaourt')
  })

  it('« Annuler » ne retire pas un aliment remis entre-temps', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Retirer Yaourt nature' }))
    // Le stock contient de nouveau le yaourt (remis à la main avant d'annuler)
    mockUndo.mock.calls[0][0].onUndo()
    expect(mockToggle).toHaveBeenCalledTimes(1)
  })

  it('ajouter ne propose pas d’annulation (rien n’est perdu)', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'riz')
    await user.click(screen.getByRole('button', { name: 'Ajouter Riz basmati' }))
    expect(mockUndo).not.toHaveBeenCalled()
  })

  it('le rond a cocher retire un aliment deja au frigo', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Retirer Yaourt nature' }))
    expect(mockToggle).toHaveBeenCalledWith('fr-yaourt')
  })

  it('le rond a cocher ajoute un aliment trouve par recherche mais pas encore au frigo', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'riz')
    await user.click(screen.getByRole('button', { name: 'Ajouter Riz basmati' }))
    expect(mockToggle).toHaveBeenCalledWith('gp-riz')
  })

  it('les puces de categorie n\'apparaissent qu\'en mode recherche', () => {
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Viande/ })).not.toBeInTheDocument()
  })

  it('un filtre de categorie restreint les resultats de recherche a la vraie sous-categorie', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'co')
    expect(screen.getByText('Cordon bleu')).toBeInTheDocument()
    expect(screen.getByText('Comté')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Viande/ }))
    expect(screen.getByText('Cordon bleu')).toBeInTheDocument()
    expect(screen.queryByText('Comté')).not.toBeInTheDocument()
  })

  it('le filtre BOF matche les vraies sous-categories dairy/cheese/eggs (regression bug 2026-07-11, ex: mozzarella/comte non trouves)', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'co')
    await user.click(screen.getByRole('button', { name: /Beurre·Œufs·Fromage/ }))
    expect(screen.getByText('Comté')).toBeInTheDocument()
    expect(screen.queryByText('Cordon bleu')).not.toBeInTheDocument()
  })

  it('une sous-categorie reelle sans filtre dedie (ex: tofu) reste visible peu importe le filtre actif', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Rechercher un aliment'), 'tofu')
    expect(screen.getByText('Tofu nature')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Viande/ }))
    expect(screen.getByText('Tofu nature')).toBeInTheDocument()
  })

  it('les filtres se reinitialisent quand la barre de recherche est revidee', async () => {
    const user = userEvent.setup()
    render(<InventoryPanel lang="fr" onClose={vi.fn()} />)
    const input = screen.getByLabelText('Rechercher un aliment')
    await user.type(input, 'co')
    await user.click(screen.getByRole('button', { name: /Viande/ }))
    await user.clear(input)
    await user.type(input, 'co')
    expect(screen.getByRole('button', { name: /Viande/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Comté')).toBeInTheDocument()
  })

  // « Vider » a quitté le menu du bouton orange (action destructrice, hors
  // d'un FAB — Material) pour vivre ici, là où l'on VOIT ce qu'on efface.
  it('propose « Vider le frigo » en pied de panneau quand le stock n’est pas vide', async () => {
    const user = userEvent.setup()
    mockStock.current = new Set(['fr-yaourt'])
    const onEmptyRequest = vi.fn()
    render(<InventoryPanel lang="fr" onClose={() => {}} onEmptyRequest={onEmptyRequest} />)
    await user.click(screen.getByRole('button', { name: 'Vider le frigo' }))
    expect(onEmptyRequest).toHaveBeenCalledOnce()
  })

  it('désactive « Vider le frigo » quand le frigo est vide, et ne le rend pas sans callback', () => {
    mockStock.current = new Set()
    const { unmount } = render(<InventoryPanel lang="fr" onClose={() => {}} onEmptyRequest={() => {}} />)
    expect(screen.getByRole('button', { name: 'Vider le frigo' })).toBeDisabled()
    unmount()
    render(<InventoryPanel lang="fr" onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Vider le frigo' })).toBeNull()
  })
})
