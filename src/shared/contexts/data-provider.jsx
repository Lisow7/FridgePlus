import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { createIngredientLookup } from '@shared/lib/ingredients/ingredient-lookup'
import { OFFICIAL_RECIPE_COLUMNS, rowToOfficialRecipe } from '@shared/lib/recipes/official-recipe-rows'
import { INGREDIENTS as STATIC_INGREDIENTS } from '@shared/static/ingredients'
import { RECIPES as STATIC_RECIPES } from '@shared/static/recipes'
import { RECIPE_NAMES as STATIC_RECIPE_NAMES } from '@shared/static/recipe-names'
import { FRIDGE_LAYOUTS as STATIC_FRIDGE_LAYOUTS } from '@shared/static/fridge-layouts'

// Les libellés de difficulté et de type vivent avec la forme d'une recette
// officielle (partagée avec la lecture d'une fiche seule) ; réexportés ici pour
// les filtres, qui les lisent à cette adresse depuis toujours.
export { DIFFICULTY_MAP, TYPE_MAP } from '@shared/lib/recipes/official-recipe-rows'

export function rowsToIngredients(rows) {
  // Build DB result sorted by sort_order
  const dbResult = {}
  ;[...rows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .forEach(row => {
      if (!dbResult[row.subcategory]) dbResult[row.subcategory] = []
      const entry = {
        id: row.id, labels: row.labels, emoji: row.emoji,
        image_url: row.image_url ?? null, price: row.price ?? {},
        seasonal_months: row.seasonal_months ?? null,
        nutrition: row.nutrition ?? {},
        allergens: row.allergens ?? [],
        pack_size: row.pack_size ?? {},
        breaks_diets: row.breaks_diets ?? [],
        default_unit: row.default_unit ?? null,
      }
      if (row.group_id) entry.group_id = row.group_id
      dbResult[row.subcategory].push(entry)
    })

  // Tous les IDs présents dans le static — empêche la réinjection d'items
  // qui ont changé de subcategory dans le static mais restent en DB à l'ancienne place
  const allStaticIds = new Set(
    Object.values(STATIC_INGREDIENTS).flatMap(items => items.map(i => i.id))
  )

  // 🔴 L'enrichissement se fait PAR ID sur TOUTES les lignes BDD, jamais par
  // sous-catégorie : le static et la BDD ne rangent pas toujours un item sous
  // la même clé (ex. `fr-brie` vit sous `bof` côté static — l'écran Beurre-
  // Œufs-Fromage — et sous `cheese` en BDD). Une jointure par sous-catégorie
  // laissait ces items SANS icône ni labels BDD ; constaté le 2026-08-27 :
  // les 22 fromages du frigo affichaient le même 🧀 générique.
  const dbByIdGlobal = {}
  for (const items of Object.values(dbResult)) for (const i of items) dbByIdGlobal[i.id] = i

  // Merge: static defines structure (parents, group_id, order), DB overrides labels/emoji + ajoute price
  const result = {}
  for (const [key, staticItems] of Object.entries(STATIC_INGREDIENTS)) {
    const dbItems = dbResult[key] ?? []
    result[key] = staticItems.map(item => {
      const db = dbByIdGlobal[item.id]
      // `db` est une `entry` déjà normalisée (?? {} / ?? [] / ?? null) plus haut —
      // pas besoin de re-fallback ici.
      return db ? {
        ...item,
        labels: db.labels, emoji: db.emoji, price: db.price,
        seasonal_months: db.seasonal_months,
        // 🔴 image_url manquait à cette liste depuis l'Icons Overhaul : tout
        // ingrédient présent dans le static perdait son icône BDD ici et
        // retombait sur l'emoji générique — alors que les 653 icônes du
        // bucket existaient. Constaté le 2026-08-27 (listes du frigo).
        image_url: db.image_url,
        nutrition: db.nutrition, allergens: db.allergens,
        pack_size: db.pack_size, breaks_diets: db.breaks_diets,
        default_unit: db.default_unit,
      } : item
    })
    const staticIds = new Set(staticItems.map(i => i.id))
    for (const dbItem of dbItems) {
      if (!staticIds.has(dbItem.id) && !allStaticIds.has(dbItem.id)) result[key].push(dbItem)
    }
  }
  // Subcategories only in DB (items ajoutés côté admin)
  for (const [key, dbItems] of Object.entries(dbResult)) {
    if (!result[key]) result[key] = dbItems.filter(item => !allStaticIds.has(item.id))
  }
  return result
}

function buildGroupMaps(ingredients) {
  const groupMap = {}   // parentId → [childId, ...]
  const parentMap = {}  // childId  → parentId
  for (const arr of Object.values(ingredients)) {
    for (const ing of arr) {
      if (!ing.group_id) continue
      parentMap[ing.id] = ing.group_id
      if (!groupMap[ing.group_id]) groupMap[ing.group_id] = []
      groupMap[ing.group_id].push(ing.id)
    }
  }
  return { groupMap, parentMap }
}

function rowsToRecipeNames(rows) {
  return Object.fromEntries(rows.map(row => [row.id, row.name]))
}

// Convertit les rows {language, structure} en map { language: structure }
function rowsToLangMap(rows) {
  return Object.fromEntries(rows.map(row => [row.language, row.structure]))
}

// ─── Taxonomies (refonte BDD Sprint 4 — PR-DB-08) ───────────────────────────
// La table `taxonomies` remplace 3 fetches (allergen_types + diet_types +
// countries_master) par 1 seul filtré par domain. Les hooks consommateurs
// (useAllergenTypes / useDietTypes / useCountries) gardent leur format de
// sortie historique pour backward compat — c'est ici qu'on reconstruit.
function partitionTaxonomyRows(rows) {
  const allergens = {}
  const diets = {}
  const countries = {}
  for (const r of rows) {
    if (r.domain === 'allergen') {
      allergens[r.key] = {
        key: r.key,
        labels: r.labels,
        icon: r.metadata?.icon ?? null,
        sort_order: r.sort_order,
      }
    } else if (r.domain === 'diet') {
      diets[r.key] = {
        key: r.key,
        labels: r.labels,
        color: r.metadata?.color ?? null,
        bg_color: r.metadata?.bg_color ?? null,
        sort_order: r.sort_order,
      }
    } else if (r.domain === 'country') {
      // Backward compat : countries expose `code` (pas `key`) + `names` (pas `labels`)
      countries[r.key] = {
        code: r.key,
        names: r.labels,
        flag: r.metadata?.flag ?? null,
        sort_order: r.sort_order,
      }
    }
  }
  return { allergens, diets, countries }
}

// Les quatre lectures du démarrage. Chacune peut échouer seule : c'est elle
// qu'on relance, pas les autres (audit du 2026-10-04, PERF-02).
const LECTURES_DU_DEMARRAGE = {
  ingredients: () => supabase.from('ingredients')
    .select('id, labels, emoji, subcategory, sort_order, group_id, price, seasonal_months, image_url, nutrition, allergens, pack_size, breaks_diets, default_unit'),
  // Refonte BDD Sprint 5 — PR-DB-12 : `base_recipes` → `recipes_unified`
  // filtré par origin='official'. RLS publique filtre déjà
  // status IN ('published','featured') donc le code app ne voit que
  // les recettes publiables (admin verra tout via is_admin policy).
  // Triggers de sync (PR-DB-11) garantissent que les writes admin
  // sur base_recipes sont reflétés ici sans drift.
  recettes: () => supabase.from('recipes_unified')
    .select(OFFICIAL_RECIPE_COLUMNS)
    .eq('origin', 'official'),
  // Refonte BDD Sprint 4 — PR-DB-08 : 3 fetches anciens (allergen_types,
  // diet_types, countries_master) → 1 fetch unifié sur la table
  // `taxonomies` filtré par domain. Gain : -2 requêtes HTTP au boot.
  taxonomies: () => supabase.from('taxonomies')
    .select('domain, key, labels, metadata, sort_order')
    .in('domain', ['allergen', 'diet', 'country'])
    .order('sort_order'),
  dispositions: () => supabase.from('fridge_layouts')
    .select('language, structure'),
}

// Attente avant chaque nouvel essai d'une lecture refusée : trois essais en tout.
const DELAIS_AVANT_NOUVEL_ESSAI = [2000, 6000]

// Une lecture rend ses lignes, ou `null` si elle a échoué — jamais d'exception.
// 🔴 Avant le 2026-10-05 : ni try/catch ni nouvel essai, et la promesse n'était
// pas attendue. Une seule lecture qui échouait (même la petite
// `fridge_layouts`), et l'app restait toute la session sur les 100 recettes
// embarquées sur 515, sans que personne ne le sache : le panneau n'en montrait
// que 100, et 81 % des liens directs restaient « Recette introuvable ».
// supabase-js LÈVE sur une requête avortée (mesuré le 2026-08-07).
async function lireUneFois(nom) {
  try {
    const { data, error } = await LECTURES_DU_DEMARRAGE[nom]()
    if (error) return null
    // Des recettes rendues vides ne sont pas un catalogue : la mémoire ne
    // ferait pas foi, et une fiche conclurait « introuvable » à tort.
    if (nom === 'recettes' && !data?.length) return null
    return data ?? []
  } catch {
    return null
  }
}

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const [ingredients,   setIngredients]   = useState(STATIC_INGREDIENTS)
  const [recipes,       setRecipes]       = useState(STATIC_RECIPES)
  const [recipeNames,   setRecipeNames]   = useState(STATIC_RECIPE_NAMES)
  const [groupMaps,     setGroupMaps]     = useState(() => buildGroupMaps(STATIC_INGREDIENTS))
  // V3 : nouveaux master tables chargés depuis la BDD
  const [dietTypes,     setDietTypes]     = useState({})       // { vegetarian: { labels, color, bg_color }, ... }
  const [allergenTypes, setAllergenTypes] = useState({})       // { gluten: { labels, icon }, ... }
  const [countries,     setCountries]     = useState({})       // { fr: { names, flag }, ... }
  const [fridgeLayouts, setFridgeLayouts] = useState(STATIC_FRIDGE_LAYOUTS)
  // 'loading' tant que le catalogue n'est pas arrivé, 'ok' une fois là, 'error'
  // quand les nouveaux essais n'y ont rien fait. Tant qu'il n'est pas 'ok', la
  // mémoire ne contient que les 100 recettes embarquées sur 515, sans étapes
  // ni descriptions : `useRecipeById` lit alors la fiche seule plutôt que de
  // conclure « introuvable ».
  const [catalogStatus, setCatalogStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false
    const minuteurs = new Set()

    const appliquer = {
      ingredients: (rows) => {
        if (!rows.length) return
        const parsed = rowsToIngredients(rows)
        setIngredients(parsed)
        setGroupMaps(buildGroupMaps(parsed))
      },
      recettes: (rows) => {
        setRecipes(rows.map(rowToOfficialRecipe))
        setRecipeNames(rowsToRecipeNames(rows))
        setCatalogStatus('ok')
      },
      taxonomies: (rows) => {
        const { allergens, diets, countries: taxCountries } = partitionTaxonomyRows(rows)
        if (Object.keys(allergens).length)   setAllergenTypes(allergens)
        if (Object.keys(diets).length)       setDietTypes(diets)
        if (Object.keys(taxCountries).length) setCountries(taxCountries)
      },
      dispositions: (rows) => { if (rows.length) setFridgeLayouts(rowsToLangMap(rows)) },
    }

    function traiter(nom, rows, essai) {
      if (cancelled) return
      if (rows) { appliquer[nom](rows); return }
      if (essai < DELAIS_AVANT_NOUVEL_ESSAI.length) {
        const minuteur = setTimeout(() => {
          minuteurs.delete(minuteur)
          if (cancelled) return
          lireUneFois(nom).then((lignes) => traiter(nom, lignes, essai + 1))
        }, DELAIS_AVANT_NOUVEL_ESSAI[essai])
        minuteurs.add(minuteur)
        return
      }
      if (nom === 'recettes') setCatalogStatus('error')
    }

    // Premier passage : les quatre ensemble, appliquées dans le même tour pour
    // un seul rendu — l'arrivée du catalogue re-rend toute l'app (PERF-10).
    async function load() {
      const noms = Object.keys(LECTURES_DU_DEMARRAGE)
      const resultats = await Promise.all(noms.map(lireUneFois))
      noms.forEach((nom, i) => traiter(nom, resultats[i], 0))
    }

    // Phase 11 PR P11.c.5 — Différer le fetch BDD après idle.
    // Les 6 tables Supabase représentaient ~258 KiB de transfer dans le
    // critical path Lighthouse (base_recipes 200 KiB + ingredients 50 KiB
    // + 4 petites tables) au boot. Lighthouse pénalisait fortement le LCP.
    //
    // L'app fonctionne IMMÉDIATEMENT avec les STATIC_* fallbacks (initialisés
    // dans useState). Le fetch BDD ne sert qu'à override avec les données
    // les plus récentes (recettes/ingrédients/etc. ajoutées par l'admin).
    // → On peut différer le fetch sans casser l'UX initiale.
    //
    // `requestIdleCallback` (fallback setTimeout 1s pour Safari) : déclenche
    // le fetch après le first paint + first interactive. Lighthouse ne compte
    // plus les 258 KiB dans le critical path. Gain estimé : -5-8 points perf.
    let idleHandle = null
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(() => { if (!cancelled) load() }, { timeout: 3000 })
    } else {
      idleHandle = setTimeout(() => { if (!cancelled) load() }, 1000)
    }

    return () => {
      cancelled = true
      if (idleHandle !== null) {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleHandle)
        } else {
          clearTimeout(idleHandle)
        }
      }
      for (const minuteur of minuteurs) clearTimeout(minuteur)
    }
  }, [])

  // Le nom d'une recette lue SEULE (lien direct, avant le catalogue) : le titre
  // de l'onglet, la modale, l'impression le cherchent dans `recipeNames`.
  // Même référence si le nom y est déjà : ni rendu de toute l'app, ni nouvelle
  // lecture de la fiche.
  const registerRecipeName = useCallback((id, name) => {
    if (!id || !name) return
    setRecipeNames((prev) => (prev[id] ? prev : { ...prev, [id]: name }))
  }, [])

  // Lookup factory + map id→ingredient — recalculés uniquement quand
  // ingredients change. Évite de rebuild à chaque render.
  const lookup = useMemo(() => createIngredientLookup(ingredients), [ingredients])
  const ingredientsById = lookup.byId
  // Lookup id → recette (recettes officielles uniquement, cf. filtre origin
  // dans le fetch ci-dessus) — permet une résolution synchrone pour les liens
  // recette-de-base (base-recipe-links.js), sans appel réseau supplémentaire.
  const recipesById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes])

  // Mémoïsation du value Provider. Avant : objet recréé
  // à chaque render → tous les consommateurs (useIngredients, useBaseRecipes,
  // useCountries, etc.) re-render même si rien n'a changé. Le DataProvider
  // wrap toute l'app → impact majeur. Identité référentielle stable
  // tant que les données BDD ne changent pas.
  const value = useMemo(() => ({
    ingredients, recipes, recipeNames, groupMaps,
    dietTypes, allergenTypes, countries, fridgeLayouts,
    lookup, ingredientsById, recipesById,
    catalogStatus, registerRecipeName,
  }), [ingredients, recipes, recipeNames, groupMaps, dietTypes, allergenTypes, countries, fridgeLayouts, lookup, ingredientsById, recipesById, catalogStatus, registerRecipeName])

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useIngredients() {
  return useContext(DataContext).ingredients
}

export function useBaseRecipes() {
  const { recipes, recipeNames, recipesById, catalogStatus, registerRecipeName } = useContext(DataContext)
  return { recipes, recipeNames, recipesById, catalogStatus, registerRecipeName }
}

export function useGroupMaps() {
  return useContext(DataContext).groupMaps
}

// V3 — nouveaux hooks pour la data master chargée depuis la BDD
export function useDietTypes() {
  return useContext(DataContext).dietTypes
}

export function useAllergenTypes() {
  return useContext(DataContext).allergenTypes
}

export function useCountries() {
  return useContext(DataContext).countries
}

export function useFridgeLayouts() {
  return useContext(DataContext).fridgeLayouts
}

// Lookup d'ingrédient (label, sous-catégorie, group_id parent…) — instance
// stable réutilisable. Voir createIngredientLookup() pour l'API.
export function useIngredientLookup() {
  return useContext(DataContext).lookup
}

// Map<id, ingredient> — utile pour calcRecipeCost, calcMissingCost.
export function useIngredientsById() {
  return useContext(DataContext).ingredientsById
}
