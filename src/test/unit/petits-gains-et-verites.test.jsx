import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useRef } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Petits gains et vérités (audit du 2026-10-04) :
// - PERF-13 : le bandeau du bas mesurait sa hauteur en plein commit
//   (`getBoundingClientRect` dans un `useLayoutEffect`) puis réécrivait une
//   variable CSS sur <html> à chaque fois — mise en page forcée, 183 ms mesurés.
//   Désormais : la mesure vient du `ResizeObserver` (après la mise en page,
//   avant la peinture), et la variable n'est réécrite que si elle change.
// - PERF-14 : le slogan de l'en-tête s'animait même masqué (sous 640 px) et
//   onglet caché — réveils du processeur pour rien.
// - Cache `immutable` des emoji auto-hébergés (`/emoji/`).
// - Accueil lisible sans JavaScript : un <noscript> avec h1, trois phrases, liens.

import { useBottomInsetPublisher, BOTTOM_INSET_VAR } from '@shared/hooks/use-bottom-inset'
import HeaderLogo from '@app/layout/header/HeaderLogo'
import { TAGLINES } from '@shared/static/taglines'
import { corpsAccueilSansJavaScript } from '@prerender/corps-statique'

function mockMatchMedia(reduit = false) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduit : false,
    media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }))
}

describe('PERF-13 — le bandeau du bas ne force plus la mise en page', () => {
  let rappels
  let hauteur
  const RO_INITIAL = window.ResizeObserver
  function Surface({ active = true }) {
    const ref = useRef(null)
    useBottomInsetPublisher(ref, active)
    return <div ref={ref} data-testid="surface" />
  }
  beforeEach(() => {
    rappels = []
    hauteur = 120
    window.ResizeObserver = class { constructor(cb) { rappels.push(cb) } observe() {} disconnect() {} }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height: hauteur, width: 390, top: 0, left: 0, right: 390, bottom: hauteur }))
  })
  afterEach(() => {
    window.ResizeObserver = RO_INITIAL
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty(BOTTOM_INSET_VAR)
  })

  it('mesure dans le rappel du ResizeObserver, pas au montage', () => {
    render(<Surface />)
    expect(rappels).toHaveLength(1)
    expect(document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)).toBe('')
    act(() => { rappels[0]() })
    expect(document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)).toBe('120px')
  })

  it('ne réécrit la variable que si la hauteur change', () => {
    const ecrire = vi.spyOn(document.documentElement.style, 'setProperty')
    render(<Surface />)
    act(() => { rappels[0]() })
    act(() => { rappels[0]() })
    expect(ecrire).toHaveBeenCalledTimes(1)
    hauteur = 140
    act(() => { rappels[0]() })
    expect(ecrire).toHaveBeenCalledTimes(2)
    expect(document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)).toBe('140px')
  })

  it('sans ResizeObserver (vieux navigateur) : une mesure au montage, comme avant', () => {
    window.ResizeObserver = undefined
    render(<Surface />)
    expect(document.documentElement.style.getPropertyValue(BOTTOM_INSET_VAR)).toBe('120px')
  })
})

describe('PERF-14 — le slogan ne s’anime pas quand personne ne le voit', () => {
  const LARGEUR = window.innerWidth
  beforeEach(() => { vi.useFakeTimers(); mockMatchMedia(false) })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.innerWidth = LARGEUR
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('sous 640 px (le slogan est masqué) : aucun cycle', () => {
    window.innerWidth = 390
    render(<HeaderLogo lang="fr" />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText(TAGLINES.fr[0])).toBeInTheDocument()
  })

  it('onglet masqué : le cycle attend le retour sur l’onglet', () => {
    window.innerWidth = 1440
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    render(<HeaderLogo lang="fr" />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByText(TAGLINES.fr[0])).toBeInTheDocument()

    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByText(TAGLINES.fr[0])).toBeNull()
  })

  it('bureau, onglet visible : le cycle part (témoin)', () => {
    window.innerWidth = 1440
    render(<HeaderLogo lang="fr" />)
    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.queryByText(TAGLINES.fr[0])).toBeNull()
  })
})

describe('les emoji auto-hébergés se gardent un an', () => {
  it('vercel.json : /emoji/ en Cache-Control immutable, comme /assets/', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
    const entree = vercel.headers.find((h) => h.source === '/emoji/(.*)')
    expect(entree).toBeDefined()
    const cache = entree.headers.find((h) => h.key === 'Cache-Control')
    expect(cache?.value).toBe('public, max-age=31536000, immutable')
  })
})

describe('accueil sans JavaScript', () => {
  it('un h1, trois phrases, des liens vers le guide, la FAQ, la communauté et les recettes', () => {
    const corps = corpsAccueilSansJavaScript('fr')
    expect(corps).toMatch(/<h1>[^<]*Fridge\+[^<]*<\/h1>/)
    expect(corps).toContain('Garnis ton frigo en quelques secondes')
    expect(corps).toContain('Vois tout de suite ce que tu peux cuisiner')
    expect(corps).toContain('Parle à ton frigo pour le remplir, sans rien taper')
    for (const lien of ['href="/guide"', 'href="/faq"', 'href="/community"', 'href="/?recettes=1"']) expect(corps).toContain(lien)
  })

  it('le pré-rendu l’injecte dans dist/index.html seul, après les autres pages', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/prerender.mjs'), 'utf8')
    expect(script).toContain('corpsAccueilSansJavaScript')
    expect(script).toMatch(/<noscript>/)
    expect(script).toMatch(/writeFileSync\(SOURCE/)
  })
})
