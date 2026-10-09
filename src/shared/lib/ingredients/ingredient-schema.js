// Phase C : schéma unifié ingrédient.
//
// Aujourd'hui, les attributs d'un ingrédient sont éparpillés dans plusieurs
// fichiers data + lib :
//   • `src/data/ingredients.js`            → id, labels, emoji, group_id,
//                                             sous-cat (via INGREDIENTS keyed)
//   • `ingredient-resolver.js`             → nutrition, packs, defaultUnit
//                                             résolus BDD-first, fallback
//                                             statique (nutrition.js /
//                                             packSizes.js)
//   • `src/data/ingredientUnitHints.js`    → altUnits, gramsPer,
//                                             reconstitutes (v3.27.7)
//   • `src/data/defaultPacksByCategory.js` → packs fallback par sous-cat
//   • `src/data/ingredientConservation.js` → conservation, storage (v3.29.0)
//   • `src/lib/seasonality.js`             → seasonal_months (depuis BDD)
//
// Ce module **agrège** ces sources en un objet unifié `FullIngredient` —
// référentiel pour les phases D/E/G/H qui consomment l'ingrédient.
//
// Pas de migration de données ici : c'est juste un résolveur. Les sources
// restent autoritaires.
//
// Pourquoi ne pas tout fusionner dans un seul gros fichier maintenant ?
//   1. Les fichiers actuels sont déjà testés et stables.
//   2. La migration vers BDD (chantier majeur) suivra son propre rythme.
//   3. Le résolveur permet de servir le même contrat partout (panier,
//      planificateur, frigo 3D, admin) sans toucher aux sources.

import { INGREDIENTS }           from '@shared/static/ingredients'
import { getUnitHints,
         getReconstitutes,
         getGramsPer }           from '@shared/static/ingredient-unit-hints'
import { getDefaultPacksFor }    from '@shared/static/default-packs-by-category'
import { getConservation }       from '@shared/static/ingredient-conservation'
import { resolvePacks }          from '@shared/lib/pricing/pricing-resolver'
import { resolveNutrition,
         resolveDefaultUnit,
         resolvePackEntry }      from '@shared/lib/ingredients/ingredient-resolver'

/**
 * Schéma cible d'un ingrédient unifié.
 *
 * @typedef {object} FullIngredient
 *
 * @property {string} id                        - identifiant canonique
 * @property {string|null} emoji                - emoji décoratif
 * @property {string|null} group_id             - parent dans la taxonomie
 * @property {string|null} subcat               - clé sous-catégorie INGREDIENTS
 *
 * @property {{fr,en,es,de,ja}} labels          - labels multilingues
 * @property {string} label                     - label dans la lang demandée
 *
 * @property {string} defaultUnit               - unité par défaut à l'ajout
 * @property {string[]} altUnits                - alternatives proposées en priorité
 * @property {object} gramsPer                  - équivalences vers grammes
 * @property {object|null} reconstitutes        - pour concentrés (v3.27.7)
 *
 * @property {Array<{size:number, unit:string, price:number}>} packs - packs grande surface
 * @property {boolean} hasSpecificPacks         - false → packs viennent du fallback subcat
 *
 * @property {{cal,prot,carb,fat,fib,al}|null} nutrition - valeurs pour 100g
 *
 * @property {object} conservation              - cf. ingredientConservation.js
 * @property {object} storage                   - rangement (incl. dans conservation)
 *
 * @property {number[]|null} seasonal_months    - mois de saison FR (1-12)
 */

// Cache : INGREDIENTS aplatis (id → entrée brute) construit à la première
// utilisation. INGREDIENTS étant un module statique, ce cache est valide pour
// toute la durée du processus.
let _flatCache = null
function getFlatIndex() {
  if (_flatCache) return _flatCache
  const idx = new Map()
  for (const [subcat, list] of Object.entries(INGREDIENTS)) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item?.id && !idx.has(item.id)) {
        idx.set(item.id, { ...item, _subcat: subcat })
      }
    }
  }
  _flatCache = idx
  return idx
}

/**
 * Agrège toutes les sources et renvoie l'objet unifié pour un ingrédient.
 * Renvoie null si l'id n'existe pas dans `INGREDIENTS`.
 *
 * @param {string} id
 * @param {'fr'|'en'|'es'|'de'|'ja'} [lang='fr']
 * @param {Map<string, object>|null} [ingredientsById=null] - Map id→item du data-provider. Si fournie et non vide, nutrition / defaultUnit / packEntry sont résolus BDD-first (sinon fallback statique).
 * @returns {FullIngredient|null}
 */
export function getFullIngredient(id, lang = 'fr', ingredientsById = null) {
  if (!id) return null
  const flat = getFlatIndex()
  const raw = flat.get(id)
  if (!raw) return null

  const hints = getUnitHints(id)
  const defaultUnit = resolveDefaultUnit(id, ingredientsById)
  const packEntry = resolvePackEntry(id, ingredientsById)
  // `resolvePacks` priorise pricing/<year>.json (Phase D), fallback
  // packSizes.js. Si aucune source n'a de pack pour cet ingrédient/lang, on
  // tombe sur le fallback par sous-catégorie (defaultPacksByCategory.js).
  const specificPacks = packEntry ? resolvePacks(id, packEntry, lang) : null
  const packs = specificPacks?.length > 0
    ? specificPacks
    : getDefaultPacksFor(raw._subcat)
  const hasSpecificPacks = !!(specificPacks?.length > 0)

  const conservation = getConservation(id)
  // `storage` est un sous-objet de conservation pour exposer juste le
  // rangement (location/compartment), commode pour le frigo 3D.
  const storage = {
    location:    conservation.location,
    compartment: conservation.compartment,
  }

  return {
    id,
    emoji:    raw.emoji ?? null,
    group_id: raw.group_id ?? null,
    subcat:   raw._subcat ?? null,

    labels: raw.labels ?? {},
    label:  raw.labels?.[lang] ?? raw.labels?.fr ?? '',

    defaultUnit,
    altUnits:    hints.altUnits ?? [],
    gramsPer:    hints.gramsPer ?? {},
    reconstitutes: getReconstitutes(id, defaultUnit) ?? null,

    packs,
    hasSpecificPacks,

    nutrition: resolveNutrition(id, ingredientsById),

    conservation,
    storage,

    // seasonal_months : on ne le met qu'à null ici (c'est une donnée BDD pour
    // le moment, pas dans `INGREDIENTS` JS). La couche caller (DataContext)
    // peut enrichir l'objet avec cette valeur après lecture BDD.
    seasonal_months: null,
  }
}

/**
 * Renvoie tous les ingrédients d'une sous-catégorie sous forme unifiée.
 * Pratique pour les vues catalogue et l'admin.
 *
 * @param {string} subcat
 * @param {string} [lang='fr']
 * @param {Map<string, object>|null} [ingredientsById=null] - Map id→item du data-provider. Si fournie et non vide, nutrition / defaultUnit / packEntry sont résolus BDD-first (sinon fallback statique).
 * @returns {FullIngredient[]}
 */
export function getFullIngredientsBySubcat(subcat, lang = 'fr', ingredientsById = null) {
  const list = INGREDIENTS[subcat]
  if (!Array.isArray(list)) return []
  return list.map(item => getFullIngredient(item.id, lang, ingredientsById)).filter(Boolean)
}

/**
 * Renvoie les conversions disponibles pour un ingrédient, pratique pour
 * l'UI de saisie d'unité.
 *
 * @param {string} id
 * @returns {{ unit: string, gramsEquivalent: number }[]}
 */
export function getUnitConversions(id) {
  const hints = getUnitHints(id)
  const gp = hints.gramsPer ?? {}
  const out = []
  for (const [unit, grams] of Object.entries(gp)) {
    if (typeof grams === 'number' && grams > 0) {
      out.push({ unit, gramsEquivalent: grams })
    }
  }
  return out
}

// Re-export utilitaires pour faciliter l'import depuis ce module unique.
export { getReconstitutes, getGramsPer, getConservation }
