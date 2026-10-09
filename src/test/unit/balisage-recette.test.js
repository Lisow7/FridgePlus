import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TYPE_OPTIONS } from '@features/admin/data/base-recipe-options'
import { recipeToSchemaOrg } from '@features/recipes/lib/recipe-to-schema-org'
import { jsonLdRecette } from '../../../scripts/lib/prerender-page.mjs'

// Le balisage `Recipe` sort de DEUX producteurs : le pré-rendu (le HTML servi,
// ce que lisent les robots sans JavaScript) et l'application (posé au montage).
// Audit du 2026-10-04, SEO-13 :
// - les types `drink` (12 recettes) et `sauce-base` (14) n'avaient de
//   catégorie ni dans l'une ni dans l'autre des deux tables jumelles — 5 % des
//   fiches sans `recipeCategory` ;
// - 71 recettes annonçaient la cuisine « International », qui n'en est pas
//   une : Schema.org attend une cuisine ou une région.
// Ce test passe par les deux producteurs, pas par leur table : c'est ce
// qu'ils écrivent qui compte.

const manifeste = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/data/prerender-manifest.json'), 'utf8'))

const PHOTO = 'https://exemple.test/photo.webp'
const PAYS = {
  intl: { names: { fr: 'International', en: 'International' } },
  it: { names: { fr: 'Italie', en: 'Italy' } },
}

function cotePrerendu(champs) {
  return jsonLdRecette({ id: 'essai', nom: 'Essai', image: PHOTO, ...champs })
}
function coteApplication(recette, lang = 'fr') {
  return recipeToSchemaOrg({ recipe: { id: 'essai', ingredients: [], ...recette }, recipeName: 'Essai', lang, countries: PAYS })
}

describe('recipeCategory — chaque type de plat a sa catégorie', () => {
  it('le pré-rendu en donne une à chaque type que l’admin peut choisir', () => {
    const sansCategorie = TYPE_OPTIONS.filter(type => !cotePrerendu({ categorie: type }).recipeCategory)
    expect(sansCategorie).toEqual([])
  })

  it('l’application aussi', () => {
    const sansCategorie = TYPE_OPTIONS.filter(type => !coteApplication({ type }).recipeCategory)
    expect(sansCategorie).toEqual([])
  })

  it('les deux disent la même chose pour chaque type', () => {
    const ecarts = TYPE_OPTIONS
      .map(type => [type, cotePrerendu({ categorie: type }).recipeCategory, coteApplication({ type }).recipeCategory])
      .filter(([, prerendu, application]) => prerendu !== application)
    expect(ecarts).toEqual([])
  })

  it('aucune fiche du manifeste ne sort sans catégorie', () => {
    const sansCategorie = manifeste.recettes
      .filter(r => r.categorie && !jsonLdRecette(r).recipeCategory)
      .map(r => `${r.id} (${r.categorie})`)
    expect(sansCategorie).toEqual([])
  })

  it('un type inconnu ne fabrique rien, même s’il porte le nom d’une propriété d’objet', () => {
    for (const type of ['inconnu', 'constructor', 'toString', '__proto__']) {
      expect(cotePrerendu({ categorie: type }).recipeCategory).toBeUndefined()
      expect(coteApplication({ type }).recipeCategory).toBeUndefined()
    }
  })
})

describe('recipeCuisine — « International » n’est pas une cuisine', () => {
  it('l’application ne l’annonce pas', () => {
    expect(coteApplication({ country: 'intl' }).recipeCuisine).toBeUndefined()
    expect(coteApplication({ country: 'intl' }, 'en').recipeCuisine).toBeUndefined()
  })

  it('le code `intl` suffit, même si son nom change dans la base', () => {
    const renomme = { intl: { names: { fr: 'Cuisine du monde' } } }
    const balisage = recipeToSchemaOrg({ recipe: { id: 'essai', ingredients: [], country: 'intl' }, recipeName: 'Essai', lang: 'fr', countries: renomme })
    expect(balisage.recipeCuisine).toBeUndefined()
  })

  it('le pré-rendu ne l’annonce pas', () => {
    expect(cotePrerendu({ cuisine: 'International' }).recipeCuisine).toBeUndefined()
  })

  it('aucune fiche du manifeste ne sort avec « International »', () => {
    const fautives = manifeste.recettes.filter(r => jsonLdRecette(r).recipeCuisine === 'International')
    expect(fautives.map(r => r.id)).toEqual([])
  })

  it('une vraie cuisine reste annoncée, des deux côtés', () => {
    expect(coteApplication({ country: 'it' }).recipeCuisine).toBe('Italie')
    expect(cotePrerendu({ cuisine: 'Italie' }).recipeCuisine).toBe('Italie')
  })
})
