import { describe, it, expect } from 'vitest'
import { BANNER_CATALOG, DEFAULT_BANNER_ID, getBanner } from '@shared/lib/banners'

describe('banners catalog', () => {
  it('ids uniques + champs requis selon kind', () => {
    const ids = BANNER_CATALOG.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(BANNER_CATALOG.length).toBeGreaterThanOrEqual(8)
    for (const b of BANNER_CATALOG) {
      expect(['gradient', 'color', 'quest']).toContain(b.kind)
      expect(b.value).toBeTruthy()
      if (b.kind === 'quest') expect(b.hero).toBeTruthy()
    }
  })

  it('DEFAULT_BANNER_ID = première entrée', () => {
    expect(DEFAULT_BANNER_ID).toBe(BANNER_CATALOG[0].id)
  })

  it('getBanner : id connu → entrée ; inconnu/null → fallback (1re)', () => {
    expect(getBanner('ocean').id).toBe('ocean')
    expect(getBanner('inconnu')).toBe(BANNER_CATALOG[0])
    expect(getBanner(null)).toBe(BANNER_CATALOG[0])
  })

  it('les 6 nouvelles bannières de récompense (unification badges/quêtes) existent', () => {
    const ids = new Set(BANNER_CATALOG.map((b) => b.id))
    for (const id of ['copper', 'crown-gold', 'horizon', 'aurora', 'violet-muse', 'starlight']) {
      expect(ids.has(id)).toBe(true)
    }
    expect(BANNER_CATALOG.length).toBe(17) // 3 libres + 14 récompenses (une par palier de badge)
  })

  it('aucun hero d\'émoji réutilisé entre bannières de récompense', () => {
    const heroes = BANNER_CATALOG.filter((b) => b.kind === 'quest').map((b) => b.hero)
    expect(new Set(heroes).size).toBe(heroes.length)
  })
})
