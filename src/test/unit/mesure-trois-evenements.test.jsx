import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, render, fireEvent, screen, act } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const mockTrack = vi.hoisted(() => vi.fn())
vi.mock('@shared/lib/observability/track', () => ({ track: mockTrack, trackOnce: vi.fn() }))
vi.mock('@shared/ui/upgrade-gate', () => ({ UpgradeGate: () => null }))

import { useTrackIngredientSearch, SEARCH_SETTLE_MS } from '@features/fridge/hooks/use-track-ingredient-search'
import { useStepsSeenRef } from '@features/recipes/hooks/use-steps-seen-ref'
import { RecipeCookFooter } from '@features/recipes/components/recipe-cook-footer'

beforeEach(() => mockTrack.mockClear())

describe('ingredient_search — une recherche aboutie, jamais le texte', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("n'émet qu'une fois la saisie arrêtée, avec le seul nombre de résultats", () => {
    const { rerender } = renderHook(({ q, n }) => useTrackIngredientSearch(q, n), { initialProps: { q: 'p', n: 40 } })
    rerender({ q: 'pa', n: 12 })
    rerender({ q: 'pât', n: 3 })
    act(() => vi.advanceTimersByTime(SEARCH_SETTLE_MS - 1))
    expect(mockTrack).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('ingredient_search', { results: 3 })
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('pât')
  })

  it("n'émet pas pour une barre vide ni deux fois pour la même saisie", () => {
    const { rerender } = renderHook(({ q, n }) => useTrackIngredientSearch(q, n), { initialProps: { q: '  ', n: 0 } })
    act(() => vi.advanceTimersByTime(SEARCH_SETTLE_MS * 2))
    expect(mockTrack).not.toHaveBeenCalled()
    rerender({ q: 'oeuf', n: 0 })
    act(() => vi.advanceTimersByTime(SEARCH_SETTLE_MS))
    rerender({ q: 'oeuf', n: 2 }) // un filtre change le compte : même saisie
    act(() => vi.advanceTimersByTime(SEARCH_SETTLE_MS))
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('ingredient_search', { results: 0 })
  })
})

describe('recipe_steps_seen — le titre des étapes passé à l’écran', () => {
  let observers
  beforeEach(() => {
    observers = []
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('émet quand l’élément devient visible, une seule fois par recette', () => {
    const { result } = renderHook(() => useStepsSeenRef('r1'))
    const node = document.createElement('p')
    act(() => result.current(node))
    act(() => observers[0].cb([{ isIntersecting: false }]))
    expect(mockTrack).not.toHaveBeenCalled()
    act(() => observers[0].cb([{ isIntersecting: true }]))
    act(() => observers[0].cb([{ isIntersecting: true }]))
    expect(mockTrack).toHaveBeenCalledTimes(1)
    expect(mockTrack).toHaveBeenCalledWith('recipe_steps_seen', { recipeId: 'r1' })
    expect(observers[0].disconnected).toBe(true)
    // L'onglet est remonté (on revient sur « Étapes ») : pas de nouvel observateur.
    act(() => result.current(node))
    expect(observers).toHaveLength(1)
  })

  it('ré-émet pour une autre recette ouverte dans la même fiche', () => {
    const { result, rerender } = renderHook(({ id }) => useStepsSeenRef(id), { initialProps: { id: 'r1' } })
    act(() => result.current(document.createElement('p')))
    act(() => observers[0].cb([{ isIntersecting: true }]))
    rerender({ id: 'r2' })
    act(() => result.current(document.createElement('p')))
    act(() => observers[1].cb([{ isIntersecting: true }]))
    expect(mockTrack.mock.calls).toEqual([
      ['recipe_steps_seen', { recipeId: 'r1' }],
      ['recipe_steps_seen', { recipeId: 'r2' }],
    ])
  })
})

describe('cook_started — toucher « J’ai cuisiné », quel que soit le chemin', () => {
  const base = {
    recipe: { id: 'r9' }, recipeSteps: [], isMobile: true, hasPremiumAccess: false, darkMode: false,
    lang: 'fr', t: { cookRecipe: "J'ai cuisiné", feedbackDone: () => 'ok' }, navigate: () => {},
    withdrawFeedback: null, setWithdrawFeedback: () => {}, feedbackTimerRef: { current: null },
    logCookedWithoutWithdraw: vi.fn(), showModeCuisine: false,
  }

  it('avec des ingrédients en stock : cook_started puis le retrait (pas encore cook_completed)', () => {
    const enterWithdraw = vi.fn()
    render(<RecipeCookFooter {...base} user={{ id: 'u' }} hasStockIngredients enterWithdraw={enterWithdraw} />)
    fireEvent.click(screen.getByRole('button', { name: "J'ai cuisiné" }))
    expect(mockTrack.mock.calls).toEqual([['cook_started', { recipeId: 'r9' }]])
    expect(enterWithdraw).toHaveBeenCalled()
  })

  it('invité sans stock : cook_started puis cook_completed', () => {
    render(<RecipeCookFooter {...base} recipeSteps={['Cuire']} user={null} hasStockIngredients={false} enterWithdraw={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: "J'ai cuisiné" }))
    expect(mockTrack.mock.calls.map(([e]) => e)).toEqual(['cook_started', 'cook_completed'])
  })
})

// La base REJETTE en silence un événement absent de sa contrainte CHECK
// (track.js avale l'erreur). Ce cliquet dérive la liste de la dernière
// migration qui redéfinit la contrainte et exige que chaque `track('…')` du
// code y figure : un événement ajouté sans migration casse ici, pas en prod.
describe('chaque événement émis est accepté par la base', () => {
  it('la contrainte product_events_event_chk couvre tous les track()', () => {
    const dir = resolve(process.cwd(), 'supabase/migrations')
    const derniere = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
      .filter((f) => readFileSync(join(dir, f), 'utf8').includes('product_events_event_chk check')).pop()
    const sql = readFileSync(join(dir, derniere), 'utf8')
    const bloc = sql.slice(sql.indexOf('product_events_event_chk check'))
    const permis = new Set([...bloc.slice(0, bloc.indexOf(')')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))

    const emis = new Set()
    const parcourir = (d) => {
      for (const e of readdirSync(d)) {
        const p = join(d, e)
        if (statSync(p).isDirectory()) { if (e !== 'test') parcourir(p); continue }
        if (!/\.(js|jsx)$/.test(e)) continue
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/\btrack\(\s*'([a-z_]+)'/g)) emis.add(m[1])
        for (const m of src.matchAll(/\btrackOnce\([^,]+,\s*'([a-z_]+)'/g)) emis.add(m[1])
      }
    }
    parcourir(resolve(process.cwd(), 'src'))

    expect(emis.size).toBeGreaterThanOrEqual(7)
    expect([...emis].filter((e) => !permis.has(e))).toEqual([])
  })
})
