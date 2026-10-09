import { describe, it, expect, beforeEach } from 'vitest'
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
})
