import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ADMIN_SECTIONS, readStoredSection, storeSection } from '@features/admin/lib/admin-section-storage'

beforeEach(() => localStorage.clear())

describe('admin-section-storage', () => {
  it('défaut = dashboard quand rien n\'est stocké', () => {
    expect(readStoredSection()).toBe('dashboard')
  })
  it('stocke et relit une section valide', () => {
    storeSection('recipes')
    expect(readStoredSection()).toBe('recipes')
  })
  it('ignore une section inconnue stockée (anti-corruption)', () => {
    localStorage.setItem('fridge-admin-section', 'pirate')
    expect(readStoredSection()).toBe('dashboard')
  })
  it('storeSection refuse une clé inconnue', () => {
    storeSection('pirate')
    expect(readStoredSection()).toBe('dashboard')
  })
  it('toutes les sections du panel sont déclarées (≥ 13)', () => {
    expect(ADMIN_SECTIONS).toContain('dashboard')
    expect(ADMIN_SECTIONS).toContain('recipes')
    expect(ADMIN_SECTIONS.length).toBeGreaterThanOrEqual(13)
  })
  // « Fonctionnalités » manquait (vu le 2026-10-08, lot 12g) : quitté sur cet
  // onglet, le panneau se rouvrait sur le tableau de bord. La liste suit
  // désormais la navigation, onglet pour onglet.
  it('chaque onglet du panneau se mémorise, ni plus ni moins', () => {
    const panneau = readFileSync(resolve(process.cwd(), 'src/features/admin/components/admin-panel.jsx'), 'utf8')
    const nav = panneau.slice(panneau.indexOf('function buildNav('), panneau.indexOf('\n}\n', panneau.indexOf('function buildNav(')))
    const onglets = [...nav.matchAll(/key:\s*'([a-z-]+)'/g)].map((m) => m[1])
    expect(onglets).toContain('features')
    expect([...ADMIN_SECTIONS].sort()).toEqual([...onglets].sort())
  })
})
