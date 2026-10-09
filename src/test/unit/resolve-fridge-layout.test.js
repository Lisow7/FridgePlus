// La forme du frigo est une PRÉFÉRENCE, la langue ne fournit que les libellés
// (décision user 2026-08-27). Défaut : top-freezer pour tout le monde.
import { describe, it, expect } from 'vitest'
import { resolveFridgeLayout, DEFAULT_FRIDGE_SHAPE, FRIDGE_SHAPES } from '@shared/lib/resolve-fridge-layout'

const LAYOUTS = {
  fr: { type: 'top-freezer', fridgeLabel: 'Frigo', fridge: [{ id: 'fresh', label: 'Frais' }], pantry: [{ id: 'dry', label: 'Épicerie sèche' }] },
  en: { type: 'side-by-side', fridgeLabel: 'Fridge', fridge: [{ id: 'fresh', label: 'Fresh' }], pantry: [{ id: 'dry', label: 'Dry goods' }] },
}

describe('resolveFridgeLayout — forme découplée de la langue', () => {
  it('sans préférence : top-freezer pour TOUTES les langues, libellés de la langue', () => {
    const en = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'en', shape: null })
    expect(en.type).toBe('top-freezer')
    expect(en.fridgeLabel).toBe('Fridge')
    const fr = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'fr', shape: undefined })
    expect(fr.type).toBe('top-freezer')
    expect(fr.fridgeLabel).toBe('Frigo')
  })

  it('préférence side-by-side en français : forme choisie + libellés FR', () => {
    const l = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'fr', shape: 'side-by-side' })
    expect(l.type).toBe('side-by-side')
    expect(l.fridgeLabel).toBe('Frigo')
    expect(l.fridge[0].label).toBe('Frais')
  })

  it('valeur inconnue (donnée corrompue ou future) : retombe sur le défaut, ne throw pas', () => {
    const l = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'en', shape: 'multi-door' })
    expect(l.type).toBe(DEFAULT_FRIDGE_SHAPE)
  })

  it('langue absente : libellés FR en secours, forme préservée', () => {
    const l = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'ja', shape: 'side-by-side' })
    expect(l.fridgeLabel).toBe('Frigo')
    expect(l.type).toBe('side-by-side')
  })

  it('layouts vides : null (l’appelant gère déjà ce cas)', () => {
    expect(resolveFridgeLayout({ layouts: {}, lang: 'fr', shape: null })).toBeNull()
  })

  it('stabilité référentielle : même objet quand la forme demandée est déjà celle du layout', () => {
    const l = resolveFridgeLayout({ layouts: LAYOUTS, lang: 'fr', shape: 'top-freezer' })
    expect(l).toBe(LAYOUTS.fr)
  })

  it('expose les 2 formes proposables (et seulement elles, pour l’UI des préférences)', () => {
    expect(FRIDGE_SHAPES).toEqual(['top-freezer', 'side-by-side'])
  })
})
