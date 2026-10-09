import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

let mockWidth = 1400
const mockStock = vi.hoisted(() => ({ current: new Set() }))
vi.mock('@shared/hooks/use-window-width', () => ({ useWindowWidth: () => mockWidth }))
vi.mock('@shared/contexts/undo-provider', () => ({ useUndo: () => ({ trigger: vi.fn() }) }))
vi.mock('@shared/contexts/feature-flags-provider', () => ({ useFeatureFlag: () => true }))
vi.mock('@shared/contexts/session-state-context', () => ({ useStockSession: () => ({ stock: mockStock.current }) }))
vi.mock('@shared/contexts/data-provider', () => ({ useIngredientsById: () => new Map(), useIngredientLookup: () => ({ getSubCategory: () => null }) }))

import FridgeFAB from '@features/fridge/components/fridge-fab'

function ensureSlot() {
  document.getElementById('header-fab-slot')?.remove()
  const slot = document.createElement('div')
  slot.id = 'header-fab-slot'
  document.body.appendChild(slot)
}

const base = {
  lang: 'fr', darkMode: false, stock: new Set(), stockCount: 0,
  onShowRecipes: vi.fn(), onShowLeftovers: vi.fn(), onVoiceToggle: vi.fn(),
  onOpenFridge: vi.fn(), onCloseFridge: vi.fn(), onClosePantry: vi.fn(),
  onEmptyOptimistic: vi.fn(), onEmptyConfirm: vi.fn(), onEmptyUndo: vi.fn(),
  isHome: true, activeTab: 'fridge', doorOpen: false, pantryOpen: false,
}

beforeEach(() => { mockWidth = 1400; mockStock.current = new Set(); ensureSlot() })

describe('FridgeFAB', () => {
  it('ne rend rien hors accueil', () => {
    render(<FridgeFAB {...base} isHome={false} />)
    expect(document.getElementById('header-fab-slot').childElementCount).toBe(0)
  })

  it('rend le déclencheur dans le slot header', () => {
    render(<FridgeFAB {...base} />)
    expect(screen.getByRole('button', { name: /actions rapides/i })).toBeInTheDocument()
  })

  it('onglet frigo fermé → menu « Ouvrir le frigo » + Recettes', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} activeTab="fridge" doorOpen={false} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.getByText('Ouvrir le frigo')).toBeInTheDocument()
    expect(screen.getByText('Recettes')).toBeInTheDocument()
  })

  it('onglet frigo ouvert → « Fermer le frigo » appelle onCloseFridge', async () => {
    const user = userEvent.setup()
    const onCloseFridge = vi.fn()
    render(<FridgeFAB {...base} activeTab="fridge" doorOpen onCloseFridge={onCloseFridge} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    await user.click(screen.getByText('Fermer le frigo'))
    expect(onCloseFridge).toHaveBeenCalledOnce()
  })

  it('garde-manger section ouverte → « Fermer le garde-manger » appelle onClosePantry', async () => {
    mockWidth = 800; const user = userEvent.setup()
    const onClosePantry = vi.fn()
    render(<FridgeFAB {...base} activeTab="pantry" pantryOpen onClosePantry={onClosePantry} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    await user.click(screen.getByText('Fermer le garde-manger'))
    expect(onClosePantry).toHaveBeenCalledOnce()
  })

  it('garde-manger rien d\'ouvert → pas d\'action ouvrir/fermer, mais Recettes oui', async () => {
    mockWidth = 800; const user = userEvent.setup()
    render(<FridgeFAB {...base} activeTab="pantry" pantryOpen={false} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.queryByText(/Ouvrir le|Fermer le/)).toBeNull()
    expect(screen.getByText('Recettes')).toBeInTheDocument()
  })

  it('menu contient « Restes » (et plus « cuisiner d\'abord »), clic → onShowLeftovers', async () => {
    const user = userEvent.setup()
    const onShowLeftovers = vi.fn()
    render(<FridgeFAB {...base} onShowLeftovers={onShowLeftovers} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.queryByText(/cuisiner d'abord/i)).toBeNull()
    const item = screen.getByText('Restes')
    expect(item).toBeInTheDocument()
    await user.click(item)
    expect(onShowLeftovers).toHaveBeenCalledOnce()
  })

  it('« Restes » n\'est PAS désactivé quand le frigo est vide (leftovers indépendants du stock)', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} stock={new Set()} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    const item = screen.getByRole('menuitem', { name: /Restes/ })
    expect(item).not.toBeDisabled()
  })

  it('badge de restes périmés sur « Restes » quand leftoversExpiredCount > 0', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} leftoversExpiredCount={2} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.getByRole('menuitem', { name: /Restes/ })).toHaveTextContent('2')
  })

  it('pas de badge quand aucun reste périmé (leftoversExpiredCount = 0)', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} leftoversExpiredCount={0} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.getByRole('menuitem', { name: 'Restes' })).not.toHaveTextContent(/\d/)
  })

  // Chantier D (2026-07-09) : la pilule « Mon frigo » du footer a été
  // déplacée dans le menu FAB — un seul point d'accès à l'inventaire.
  it('menu contient « Inventaire » avec le compte du stock', async () => {
    mockStock.current = new Set(['fr-tomate', 'vg-carotte'])
    const user = userEvent.setup()
    render(<FridgeFAB {...base} stock={mockStock.current} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    expect(screen.getByText('Inventaire (2)')).toBeInTheDocument()
  })

  it('clic sur « Inventaire » ouvre le panneau inventaire', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    await user.click(screen.getByText('Inventaire (0)'))
    expect(screen.getByText(/Ton frigo est vide/)).toBeInTheDocument()
  })

  // Réorganisation FAB (2026-08-27) : menu à SECTIONS TITRÉES — les
  // Trois verbes dans l'ordre où on les fait (spec 2026-09-11) : Remplir
  // (cocher, voix, ticket) → Vérifier (inventaire, restes) → Cuisiner. Six
  // entrées, la limite Material d'un FAB menu ; « Vider » a rejoint le
  // panneau Inventaire (action destructrice, hors d'un FAB).
  it('raconte Remplir → Vérifier → Cuisiner, sept entrées, sans Vider', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} activeTab="fridge" doorOpen={false} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    const labels = screen.getAllByRole('menuitem').map(el => el.textContent.trim())
    // Le mock du fichier force le flag receipt_scan à true → « Photo du ticket » présent.
    expect(labels).toEqual([
      expect.stringMatching(/^Ouvrir le frigo/), expect.stringMatching(/^Chercher un aliment/), expect.stringMatching(/^À la voix/), expect.stringMatching(/^Photo du ticket/),
      expect.stringMatching(/^Inventaire \(0\)/), expect.stringMatching(/^Restes/), expect.stringMatching(/^Recettes/),
    ])
    expect(screen.queryByRole('menuitem', { name: /^Vider/ })).toBeNull()
    expect(screen.getByRole('group', { name: 'Remplir' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Vérifier' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Cuisiner' })).toBeInTheDocument()
  })

  it('chaque entrée garde son libellé court pour nom, et porte son explication en description', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} activeTab="fridge" doorOpen={false} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    const ticket = screen.getByRole('menuitem', { name: 'Photo du ticket' })
    expect(ticket).toHaveAccessibleDescription('Toutes tes courses d’un coup')
    const restes = screen.getByRole('menuitem', { name: 'Restes' })
    expect(restes).toHaveAccessibleDescription('Tes plats cuisinés, et leur fraîcheur')
  })

  it('en anglais, groupes et explications sont traduits', async () => {
    const user = userEvent.setup()
    render(<FridgeFAB {...base} lang="en" activeTab="fridge" doorOpen={false} />)
    await user.click(screen.getByRole('button', { name: /quick actions/i }))
    expect(screen.getByRole('group', { name: 'Fill' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Check' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Receipt photo' })).toHaveAccessibleDescription('All your groceries at once')
  })

  it('« Inventaire » ouvre le panneau avec le bouton « Vider le frigo », qui ouvre la confirmation', async () => {
    const user = userEvent.setup()
    mockStock.current = new Set(['fr-oeufs-standard'])
    render(<FridgeFAB {...base} stock={new Set(['fr-oeufs-standard'])} activeTab="fridge" doorOpen={false} />)
    await user.click(screen.getByRole('button', { name: /actions rapides/i }))
    await user.click(screen.getByRole('menuitem', { name: /^Inventaire/ }))
    await user.click(screen.getByRole('button', { name: 'Vider le frigo' }))
    expect(screen.getByRole('dialog', { name: 'Vider ton frigo ?' })).toBeInTheDocument()
  })
})
