import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROUTES } from '@routes/routes-config'

// La fiche et sa modale partent ENSEMBLE (audit du 2026-10-04, PERF-02 et
// PERF-05).
//
// La page `/recipe/:id` affiche la recette dans `RecipeModal` (126 Ko). Chargée
// en `lazy()`, son fichier n'était demandé qu'une fois la recette trouvée —
// entrée → page → données → modale, une cascade (en production : demandée à
// 1,88 s) — et `lazy()` posait un squelette entre le HTML pré-rendu et la fiche,
// même quand le fichier était déjà là. La page l'importe désormais directement :
// les deux fichiers partent ensemble, et la route préchargée (`main.jsx`) les a
// tous les deux avant le premier rendu.

const RACINE = resolve(__dirname, '../../..')
const PAGE = readFileSync(resolve(RACINE, 'src/features/recipes/pages/recipe-page.jsx'), 'utf8')

describe('la page de fiche et sa modale', () => {
  it('la page importe sa modale directement', () => {
    expect(PAGE).toMatch(/^import RecipeModal from '@features\/recipes\/components\/recipe-modal'$/m)
  })

  it('… et plus en lazy()', () => {
    expect(PAGE).not.toMatch(/lazy\(\s*\(\)\s*=>\s*import\(\s*['"]@features\/recipes\/components\/recipe-modal['"]/)
  })

  it('la route de la fiche est préchargeable avant le premier rendu', () => {
    const route = ROUTES.find((r) => r.path === '/recipe/:id')
    expect(typeof route.Component.precharger).toBe('function')
  })
})
