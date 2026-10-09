// src/shared/lib/ingredients/ingredient-resolver.js
//
// Résolveur : source unique de lecture des métadonnées d'un ingrédient depuis
// `ingredientsById` (Map<id, item> du data-provider, alimentée par la BDD).
//
// Nutrition + allergènes : BDD = source unique. La table statique `nutrition.js`
// n'est plus lue au runtime — elle sert uniquement de seed d'édition synchronisé
// vers la BDD via `npm run migrate`. Complétude BDD vérifiée (0 régression).
//
// Unité par défaut + packs : règle value-based « BDD-first, fallback statique »
// — la valeur BDD est retenue si « non vide », sinon on retombe sur la donnée
// statique (`getUnitHints`, `PACK_SIZES`).

import { getUnitHints } from '@shared/static/ingredient-unit-hints'
import { PACK_SIZES } from '@shared/static/pack-sizes'

const NUTRITION_KEYS = ['cal', 'prot', 'carb', 'fat', 'fib']

function dbItem(id, ingredientsById) {
  if (!id || !ingredientsById?.get) return null
  return ingredientsById.get(id) ?? null
}

// « non vide » : objet nutrition avec au moins une macro numérique renseignée.
// Note : les items à macros toutes nulles sont traités comme vides (→ null) ;
// les allergènes sont récupérés séparément par resolveAllergens, donc ce gating
// ne cause aucune perte d'allergène.
function hasNutrition(n) {
  return !!n && typeof n === 'object'
    && NUTRITION_KEYS.some(k => Number.isFinite(n[k]) && n[k] !== 0)
}

/**
 * Résout les valeurs nutritionnelles (pour 100g) d'un ingrédient.
 *
 * Source unique : la BDD (`ingredientsById`). Renvoie l'objet `nutrition` BDD
 * s'il est non vide (au moins une macro numérique renseignée), sinon `null`.
 *
 * @param {string} id
 * @param {Map<string, object>} ingredientsById  - Map id→item du data-provider.
 * @returns {{cal:number, prot:number, carb:number, fat:number, fib:number, al:string[]}|null}
 *   L'objet nutrition BDD, ou `null` si l'ingrédient est inconnu / sans macros.
 */
export function resolveNutrition(id, ingredientsById) {
  const db = dbItem(id, ingredientsById)
  if (hasNutrition(db?.nutrition)) return db.nutrition
  return null
}

/**
 * Résout la liste des clés d'allergènes d'un ingrédient.
 *
 * Source unique : la BDD (`ingredientsById`). Stratégie :
 *   1. Colonne BDD `allergens` non vide → prioritaire.
 *   2. Sinon, `nutrition.al` BDD non vide (allergènes embarqués dans le jsonb).
 *   3. Sinon `[]`.
 *
 * @param {string} id
 * @param {Map<string, object>} ingredientsById  - Map id→item du data-provider.
 * @returns {string[]} La liste des clés d'allergènes (jamais `null` — `[]` si
 *   aucun allergène en BDD).
 */
export function resolveAllergens(id, ingredientsById) {
  const db = dbItem(id, ingredientsById)
  if (Array.isArray(db?.allergens) && db.allergens.length > 0) return db.allergens
  if (Array.isArray(db?.nutrition?.al) && db.nutrition.al.length > 0) return db.nutrition.al
  return []
}

/**
 * Résout l'unité de mesure par défaut d'un ingrédient.
 *
 * Stratégie de résolution :
 *   1. Colonne BDD `default_unit` (string non vide) → prioritaire.
 *   2. Sinon fallback sur les hints statiques (`getUnitHints`).
 *
 * @param {string} id
 * @param {Map<string, object>} ingredientsById  - Map id→item du data-provider.
 * @returns {string} L'unité par défaut (toujours une string — les hints
 *   statiques garantissent un fallback global).
 */
export function resolveDefaultUnit(id, ingredientsById) {
  const db = dbItem(id, ingredientsById)
  if (typeof db?.default_unit === 'string' && db.default_unit.length > 0) return db.default_unit
  return getUnitHints(id).defaultUnit
}

/**
 * Résout l'entrée `pack_size` (multi-langue) d'un ingrédient.
 *
 * Stratégie de résolution :
 *   1. Si l'item BDD a un objet `pack_size` avec au moins UNE langue dont le
 *      tableau de packs est non vide, on renvoie l'objet BDD entier. La
 *      sélection par langue est faite en aval (résolveur pricing), pas ici.
 *   2. Sinon fallback sur la table statique `PACK_SIZES`.
 *
 * @param {string} id
 * @param {Map<string, object>} ingredientsById  - Map id→item du data-provider.
 * @returns {Object<string, Array<{size:number, unit:string, price:number}>>|null}
 *   L'objet pack_size par langue (BDD ou statique), ou `null` si aucun pack
 *   nulle part.
 */
export function resolvePackEntry(id, ingredientsById) {
  const db = dbItem(id, ingredientsById)
  const dbPacks = db?.pack_size
  const hasAnyPack = dbPacks && typeof dbPacks === 'object'
    && Object.values(dbPacks).some(arr => Array.isArray(arr) && arr.length > 0)
  if (hasAnyPack) return dbPacks
  return PACK_SIZES[id] ?? null
}
