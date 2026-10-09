import { describe, it, expect } from 'vitest'
import {
  OFFICIAL_RECIPE_COLUMNS,
  OFFICIAL_RECIPE_FULL_COLUMNS,
  rowToOfficialRecipe,
} from '@shared/lib/recipes/official-recipe-rows'

// Le catalogue maigrit (audit du 2026-10-04, PERF-01). Les étapes (494 Ko) et
// les descriptions (146 Ko) faisaient 41 % des octets des 515 recettes (mesuré
// sur la base le 2026-10-05), téléchargés sur chaque page alors qu'aucune
// liste, aucun filtre, aucune carte ne les lit : seule la fiche s'en sert, et
// elle les lit désormais seule (`getOfficialRecipeById`).

const colonnes = (liste) => liste.split(',').map((c) => c.trim())

describe('catalogue mince, fiche complète', () => {
  it('le catalogue ne demande ni les étapes ni les descriptions', () => {
    expect(colonnes(OFFICIAL_RECIPE_COLUMNS)).not.toContain('steps')
    expect(colonnes(OFFICIAL_RECIPE_COLUMNS)).not.toContain('description')
  })

  it('la fiche les demande, avec tout ce que demande le catalogue', () => {
    const fiche = colonnes(OFFICIAL_RECIPE_FULL_COLUMNS)
    expect(fiche).toContain('steps')
    expect(fiche).toContain('description')
    for (const c of colonnes(OFFICIAL_RECIPE_COLUMNS)) expect(fiche).toContain(c)
  })

  // Une recette du catalogue n'a PAS de clé `steps` : c'est ce qui dit à la
  // fiche qu'il faut lire la version complète (comme pour une recette embarquée).
  it('une ligne du catalogue donne une recette sans étapes ni description', () => {
    const recette = rowToOfficialRecipe({ id: 'affogato', time_min: 5, ingredients: [] })
    expect('steps' in recette).toBe(false)
    expect('description' in recette).toBe(false)
  })

  it('une ligne de fiche donne une recette complète, même vide', () => {
    const recette = rowToOfficialRecipe({ id: 'affogato', steps: null, description: { fr: 'Café' } })
    expect(recette.steps).toEqual({})
    expect(recette.description).toEqual({ fr: 'Café' })
  })
})
