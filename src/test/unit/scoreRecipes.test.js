import { describe, it, expect } from 'vitest'
import { scoreRecipes } from '@shared/static/recipes'

// ─── Recettes de test minimales ──────────────────────────────────────────────
const carbonara = {
  id: 'carbonara', emoji: '🍝', time: '20 min', difficulty: 'Intermédiaire', type: 'Plat principal', servings: 2,
  ingredients: [
    { ids: ['gp-pates'],      required: true,  labels: { fr: 'Pâtes' } },
    { ids: ['fr-lardons'],    required: true,  labels: { fr: 'Lardons' } },
    { ids: ['fr-oeuf'],       required: true,  labels: { fr: 'Œufs' } },
    { ids: ['fr-parmesan'],   required: true,  labels: { fr: 'Parmesan' } },
    { ids: ['sp-poivre'],     required: false, labels: { fr: 'Poivre' } }, // optionnel
  ],
}

const omelette = {
  id: 'omelette', emoji: '🍳', time: '10 min', difficulty: 'Très facile', type: 'Plat principal', servings: 1,
  ingredients: [
    { ids: ['fr-oeuf'],       required: true,  labels: { fr: 'Œufs' } },
    { ids: ['fr-beurre'],     required: true,  labels: { fr: 'Beurre' } },
    { ids: ['fr-parmesan', 'fr-gruyere'], required: true, labels: { fr: 'Fromage' } },
  ],
}

const sauteDeTomates = {
  id: 'saute-tomates', emoji: '🍅', time: '15 min', difficulty: 'Facile', type: 'Accompagnement', servings: 2,
  ingredients: [
    { ids: ['vg-tomate'],     required: true,  labels: { fr: 'Tomate' } },
    { ids: ['sp-sel'],        required: true,  labels: { fr: 'Sel' } },
  ],
}

const recetteSansRequis = {
  id: 'sans-requis', emoji: '✨', time: '5 min', difficulty: 'Facile', type: 'Dessert', servings: 1,
  ingredients: [
    { ids: ['sp-cannelle'],   required: false, labels: { fr: 'Cannelle' } },
  ],
}

describe('scoreRecipes', () => {

  // ─── Stock vide ─────────────────────────────────────────────────────────────
  describe('stock vide', () => {
    it('matchPercent = 0 pour toutes les recettes', () => {
      const result = scoreRecipes([carbonara, omelette], new Set(), null)
      result.forEach(r => expect(r.matchPercent).toBe(0))
    })

    it('missing contient tous les ingrédients requis', () => {
      const [r] = scoreRecipes([carbonara], new Set(), null)
      expect(r.missing).toHaveLength(4) // 4 requis, 1 optionnel ignoré
    })

    it('matchCount = 0', () => {
      const [r] = scoreRecipes([omelette], new Set(), null)
      expect(r.matchCount).toBe(0)
    })
  })

  // ─── Stock partiel ──────────────────────────────────────────────────────────
  describe('stock partiel', () => {
    it('50% si 2 requis sur 4 présents', () => {
      const stock = new Set(['gp-pates', 'fr-lardons'])
      const [r] = scoreRecipes([carbonara], stock, null)
      expect(r.matchPercent).toBeCloseTo(0.5)
      expect(r.matchCount).toBe(2)
    })

    it('missing ne contient que les ingrédients absents', () => {
      const stock = new Set(['gp-pates', 'fr-lardons'])
      const [r] = scoreRecipes([carbonara], stock, null)
      const missingIds = r.missing.flatMap(i => i.ids)
      expect(missingIds).toContain('fr-oeuf')
      expect(missingIds).toContain('fr-parmesan')
      expect(missingIds).not.toContain('gp-pates')
    })
  })

  // ─── Stock complet ──────────────────────────────────────────────────────────
  describe('stock complet', () => {
    it('matchPercent = 1 quand tous les requis sont présents', () => {
      const stock = new Set(['gp-pates', 'fr-lardons', 'fr-oeuf', 'fr-parmesan'])
      const [r] = scoreRecipes([carbonara], stock, null)
      expect(r.matchPercent).toBe(1)
      expect(r.missing).toHaveLength(0)
    })

    it('les ingrédients optionnels absents ne réduisent pas le score', () => {
      // sp-poivre est optionnel et absent — score doit quand même être 1
      const stock = new Set(['gp-pates', 'fr-lardons', 'fr-oeuf', 'fr-parmesan'])
      const [r] = scoreRecipes([carbonara], stock, null)
      expect(r.matchPercent).toBe(1)
    })
  })

  // ─── Alternatives ────────────────────────────────────────────────────────────
  describe('alternatives dans ids[]', () => {
    it('avoir l\'un des ids suffit pour valider l\'ingrédient', () => {
      // omelette attend fr-parmesan OU fr-gruyere
      const stock = new Set(['fr-oeuf', 'fr-beurre', 'fr-gruyere'])
      const [r] = scoreRecipes([omelette], stock, null)
      expect(r.matchPercent).toBe(1)
    })

    it('n\'importe quelle alternative valide le slot', () => {
      const stock = new Set(['fr-oeuf', 'fr-beurre', 'fr-parmesan'])
      const [r] = scoreRecipes([omelette], stock, null)
      expect(r.matchPercent).toBe(1)
    })

    it('slot non validé si aucune alternative présente', () => {
      const stock = new Set(['fr-oeuf', 'fr-beurre']) // fromage absent
      const [r] = scoreRecipes([omelette], stock, null)
      expect(r.matchPercent).toBeCloseTo(2 / 3)
    })
  })

  // ─── Tri ──────────────────────────────────────────────────────────────────
  describe('tri par matchPercent décroissant', () => {
    it('la recette avec le plus d\'ingrédients est en premier', () => {
      const stock = new Set(['fr-oeuf', 'fr-beurre', 'fr-parmesan'])
      // omelette : 3/3 = 1.0, carbonara : 2/4 = 0.5
      const result = scoreRecipes([carbonara, omelette], stock, null)
      expect(result[0].id).toBe('omelette')
      expect(result[1].id).toBe('carbonara')
    })

    it('scores identiques → ordre stable', () => {
      const result = scoreRecipes([carbonara, omelette, sauteDeTomates], new Set(), null)
      result.forEach(r => expect(r.matchPercent).toBe(0))
    })

    it('résultat trié du score le plus élevé au plus bas', () => {
      const stock = new Set(['vg-tomate', 'sp-sel']) // 100% pour sauteDeTomates
      const result = scoreRecipes([carbonara, omelette, sauteDeTomates], stock, null)
      expect(result[0].id).toBe('saute-tomates')
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].matchPercent).toBeGreaterThanOrEqual(result[i + 1].matchPercent)
      }
    })
  })

  // ─── Cas limites ─────────────────────────────────────────────────────────
  describe('cas limites', () => {
    it('recette sans ingrédients requis → matchPercent = 0', () => {
      const stock = new Set(['sp-cannelle'])
      const [r] = scoreRecipes([recetteSansRequis], stock, null)
      expect(r.matchPercent).toBe(0)
    })

    it('liste vide de recettes → retourne []', () => {
      expect(scoreRecipes([], new Set(['fr-oeuf']), null)).toEqual([])
    })

    it('groupMaps null → fonctionne sans expansion', () => {
      const stock = new Set(['gp-pates', 'fr-lardons', 'fr-oeuf', 'fr-parmesan'])
      const [r] = scoreRecipes([carbonara], stock, null)
      expect(r.matchPercent).toBe(1)
    })

    it('requiredCount reflète le nombre d\'ingrédients requis (pas optionnels)', () => {
      const [r] = scoreRecipes([carbonara], new Set(), null)
      expect(r.requiredCount).toBe(4) // 4 requis, 1 optionnel
    })
  })

  // ─── expandStock avec groupMaps ─────────────────────────────────────────
  describe('expandStock — groupMaps', () => {
    it('le parent dans le stock couvre les enfants', () => {
      const groupMaps = {
        groupMap:  { 'fr-oeufs': ['fr-oeuf-bio', 'fr-oeuf-fermier'] },
        parentMap: { 'fr-oeuf-bio': 'fr-oeufs', 'fr-oeuf-fermier': 'fr-oeufs' },
      }
      const recetteAvecAlias = {
        id: 'test', emoji: '🥚', time: '5 min', difficulty: 'Facile', type: 'Plat', servings: 1,
        ingredients: [
          { ids: ['fr-oeuf-bio'], required: true, labels: { fr: 'Œuf bio' } },
        ],
      }
      // Si on a le parent 'fr-oeufs' dans le stock, il couvre 'fr-oeuf-bio'
      const stock = new Set(['fr-oeufs'])
      const [r] = scoreRecipes([recetteAvecAlias], stock, groupMaps)
      expect(r.matchPercent).toBe(1)
    })

    it('sans groupMaps le parent ne couvre pas les enfants', () => {
      const recetteAvecAlias = {
        id: 'test', emoji: '🥚', time: '5 min', difficulty: 'Facile', type: 'Plat', servings: 1,
        ingredients: [
          { ids: ['fr-oeuf-bio'], required: true, labels: { fr: 'Œuf bio' } },
        ],
      }
      const stock = new Set(['fr-oeufs']) // parent, pas d'expansion
      const [r] = scoreRecipes([recetteAvecAlias], stock, null)
      expect(r.matchPercent).toBe(0)
    })
  })

  // ─── Format ingrédients enrichi (groups + sub_recipes, D18/D19) ──────────
  // Régression : une recette au format enrichi crashait ici avec
  // "recipe.ingredients.filter is not a function" (ingredients n'est plus un
  // array mais {groups, sub_recipes}) — trouvé en test live 2026-07-14.
  describe('format ingrédients enrichi (groups + sub_recipes)', () => {
    const lasagnesGroupees = {
      id: 'lasagnes-test', emoji: '🍝', time: '1 h', difficulty: 'Intermédiaire', type: 'Plat', servings: 6,
      ingredients: {
        groups: [
          { name: null, items: [
            { ids: ['gp-lasagnes-sec'], required: true, labels: { fr: 'Lasagnes' } },
          ] },
          { name: { fr: 'Pour la béchamel' }, items: [
            { ids: ['fr-beurre'], required: true, labels: { fr: 'Beurre' } },
            { ids: ['fr-lait'], required: true, labels: { fr: 'Lait' } },
          ] },
        ],
        sub_recipes: [{ recipe_id: 'bechamel-maison', scale: 1 }],
      },
    }

    it('ne crashe pas et score les ingrédients de tous les groupes', () => {
      expect(() => scoreRecipes([lasagnesGroupees], new Set(), null)).not.toThrow()
    })

    it('matchPercent tient compte des ingrédients du groupe nommé', () => {
      const stock = new Set(['gp-lasagnes-sec', 'fr-beurre', 'fr-lait'])
      const [r] = scoreRecipes([lasagnesGroupees], stock, null)
      expect(r.matchPercent).toBe(1)
      expect(r.requiredCount).toBe(3)
    })

    it('missing reflète les ingrédients absents à travers les groupes', () => {
      const stock = new Set(['gp-lasagnes-sec'])
      const [r] = scoreRecipes([lasagnesGroupees], stock, null)
      const missingIds = r.missing.flatMap(i => i.ids)
      expect(missingIds).toContain('fr-beurre')
      expect(missingIds).toContain('fr-lait')
      expect(missingIds).not.toContain('gp-lasagnes-sec')
    })
  })
})
