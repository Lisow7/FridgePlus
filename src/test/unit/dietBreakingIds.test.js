import { describe, it, expect } from 'vitest'
import { DIET_BREAKING_IDS } from '@shared/static/diet-breaking-ids'

// Tests de non-régression : on garantit que les IDs PARENTS génériques
// (ex : 'fr-lait', 'fr-fromage', 'fr-poulet') déclenchent bien la
// décoche automatique des badges Végétarien / Vegan / Sans gluten / Sans lactose.
// Ce test bloquera tout retrait accidentel d'un ID parent du set.

describe('DIET_BREAKING_IDS — structure', () => {
  it('expose 4 régimes auto-détectés (halal exclu — manuel)', () => {
    expect(Object.keys(DIET_BREAKING_IDS).sort()).toEqual([
      'dairy-free', 'gluten-free', 'vegan', 'vegetarian',
    ])
    expect(DIET_BREAKING_IDS).not.toHaveProperty('halal')
  })
  it('chaque régime est un Set non vide', () => {
    for (const [diet, set] of Object.entries(DIET_BREAKING_IDS)) {
      expect(set, diet).toBeInstanceOf(Set)
      expect(set.size, diet).toBeGreaterThan(0)
    }
  })
})

describe('DIET_BREAKING_IDS — IDs parents (corrige le bug "Lait ne décoche pas dairy-free")', () => {
  describe('vegetarian', () => {
    const s = DIET_BREAKING_IDS.vegetarian
    it('inclut tous les parents de viandes', () => {
      ;['fr-boeuf','fr-poulet','fr-porc','fr-veau','fr-canard','fr-agneau','fr-foie'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut tous les parents de poissons', () => {
      ;['fr-poissons','fr-fruits-mer','fr-poissons-fumes','frz-poissons','frz-fruits-mer'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut tous les parents de charcuterie', () => {
      ;['fr-jambon','fr-saucisse-seche','fr-pate-terrine'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut les sauces japonaises à base de poisson', () => {
      ;['jp-katsuobushi','jp-niboshi','jp-sakura-ebi','jp-dashi-pack','jp-mentsuyu'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
  })

  describe('vegan (superset de vegetarian + dairy-free + œufs)', () => {
    const s = DIET_BREAKING_IDS.vegan
    it('inclut tous les ingrédients vegetarian', () => {
      for (const id of DIET_BREAKING_IDS.vegetarian) expect(s.has(id), id).toBe(true)
    })
    it('inclut le parent fr-oeuf et toutes les variantes', () => {
      ;['fr-oeuf','fr-oeufs-bio','fr-oeufs-fermier','fr-oeufs-plein-air','fr-oeufs-standard'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut tous les parents laitiers', () => {
      ;['fr-lait','fr-creme','fr-yaourt','fr-fromage','fr-beurre'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut le miel', () => expect(s.has('gp-miel')).toBe(true))
  })

  describe('gluten-free', () => {
    const s = DIET_BREAKING_IDS['gluten-free']
    it('inclut les parents pain et pâtes', () => {
      ;['gp-pain','gp-pates','frz-viennoiseries','frz-pains-cong'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut les nouilles asiatiques à base de blé', () => {
      ;['jp-fu','jp-udon','jp-ramen-sec','jp-somen','jp-yakisoba-men','jp-hiyamugi'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('n\'inclut PAS les nouilles/farines naturellement gluten-free', () => {
      // Risquerait de fausses détections : sarrasin, riz, maïs sont sans gluten.
      ;['gp-farine-sarrasin','gp-farine-riz','gp-farine-pois-ch','gp-galettes-riz','jp-bifun','jp-harusame'].forEach(id =>
        expect(s.has(id), id).toBe(false))
    })
  })

  describe('dairy-free (corrige le bug "Lait ne décoche pas le badge")', () => {
    const s = DIET_BREAKING_IDS['dairy-free']
    it('inclut tous les parents laitiers (régression du bug initial)', () => {
      ;['fr-lait','fr-creme','fr-yaourt','fr-fromage','fr-beurre','fr-ghee'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut tous les fromages', () => {
      ;['fr-mozzarella','fr-parmesan','fr-feta','fr-burrata','fr-mascarpone','fr-ricotta'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut les plats préparés à base de fromage / crème', () => {
      ;['frz-tartiflette','frz-gratin','frz-lasagnes','frz-quiche','frz-pizza'].forEach(id =>
        expect(s.has(id), id).toBe(true))
    })
    it('inclut toutes les glaces lactées (pas les sorbets)', () => {
      expect(s.has('frz-magnum')).toBe(true)
      expect(s.has('frz-bac-vanille')).toBe(true)
      // Sorbet exclu volontairement (fruit + eau, dairy-free)
      expect(s.has('frz-sorbet')).toBe(false)
    })
    it('n\'inclut PAS les laits végétaux ni les fromages végétaux', () => {
      ;['fr-lait-amande','fr-lait-avoine','fr-lait-soja','fr-creme-soja','fr-creme-avoine'].forEach(id =>
        expect(s.has(id), id).toBe(false))
    })
  })
})
