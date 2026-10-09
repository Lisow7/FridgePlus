import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@shared/lib/supabase/client'
import { createIngredientLookup } from '@shared/lib/ingredients/ingredient-lookup'
import { INGREDIENTS as STATIC_INGREDIENTS } from '@shared/static/ingredients'
import { RECIPES as STATIC_RECIPES } from '@shared/static/recipes'
import { RECIPE_NAMES as STATIC_RECIPE_NAMES } from '@shared/static/recipe-names'
import { FRIDGE_LAYOUTS as STATIC_FRIDGE_LAYOUTS } from '@shared/static/fridge-layouts'

export const DIFFICULTY_MAP = {
  'very-easy': 'Très facile',
  'easy':      'Facile',
  'medium':    'Intermédiaire',
  'hard':      'Difficile',
}

export const TYPE_MAP = {
  'main':       'Plat principal',
  'starter':    'Entrée & Soupe',
  'side':       'Accompagnement',
  'dessert':    'Dessert & Petit-déj',
  'salad':      'Salade',
  'drink':      'Boisson',
  'sauce-base': 'Sauce & Base',
}

function formatTimeMin(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

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

function rowsToRecipes(rows) {
  return rows.map(row => ({
    id:                   row.id,
    emoji:                row.emoji,
    time:                 formatTimeMin(row.time_min),
    time_min:             row.time_min,
    prep_time_min:        row.prep_time_min,
    cook_time_min:        row.cook_time_min,
    difficulty:           DIFFICULTY_MAP[row.difficulty] ?? row.difficulty,
    type:                 TYPE_MAP[row.type] ?? row.type,
    servings:             row.servings,
    country:              row.country,
    diet:                 row.diet ?? [],
    allergens:            row.allergens ?? [],
    ingredients:          row.ingredients ?? [],
    description:          row.description ?? {},   // multilingue : {fr, en, es, de, ja}
    steps:                row.steps ?? {},         // multilingue : {fr: [...], en: [...], ...}
    image_url:            row.image_url,
    status:               row.status ?? 'published',
    // Hotfix v3.408 — flags promus pour le badge « Authentique » : si
    // promoted_from_id est non-null, la recette a été promue par l'admin
    // depuis custom_recipes (= recette d'origine communauté validée +
    // promue dans la base officielle). On expose aussi original_author_*
    // pour le crédit visible dans la fiche.
    promoted_from_id:     row.promoted_from_id ?? null,
    promoted_at:          row.promoted_at ?? null,
    original_author_name: row.original_author_name ?? null,
    original_author_id:   row.original_author_id ?? null,
    created_at:           row.created_at ?? null,
    functional_tags:      row.functional_tags ?? [],
  }))
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [
        { data: ingRows },
        { data: recRows },
        { data: taxonomyRows },
        { data: layoutRows },
      ] = await Promise.all([
        supabase.from('ingredients')
          .select('id, labels, emoji, subcategory, sort_order, group_id, price, seasonal_months, image_url, nutrition, allergens, pack_size, breaks_diets, default_unit'),
        // Refonte BDD Sprint 5 — PR-DB-12 : `base_recipes` → `recipes_unified`
        // filtré par origin='official'. RLS publique filtre déjà
        // status IN ('published','featured') donc le code app ne voit que
        // les recettes publiables (admin verra tout via is_admin policy).
        // Triggers de sync (PR-DB-11) garantissent que les writes admin
        // sur base_recipes sont reflétés ici sans drift.
        supabase.from('recipes_unified')
          .select('id, name, description, emoji, time_min, prep_time_min, cook_time_min, difficulty, type, servings, country, diet, allergens, ingredients, steps, image_url, status, promoted_from_id, promoted_at, original_author_id, original_author_name, created_at, functional_tags')
          .eq('origin', 'official'),
        // Refonte BDD Sprint 4 — PR-DB-08 : 3 fetches anciens (allergen_types,
        // diet_types, countries_master) → 1 fetch unifié sur la table
        // `taxonomies` filtré par domain. Gain : -2 requêtes HTTP au boot.
        supabase.from('taxonomies')
          .select('domain, key, labels, metadata, sort_order')
          .in('domain', ['allergen', 'diet', 'country'])
          .order('sort_order'),
        supabase.from('fridge_layouts')
          .select('language, structure'),
      ])
      if (cancelled) return
      if (ingRows?.length) {
        const parsed = rowsToIngredients(ingRows)
        setIngredients(parsed)
        setGroupMaps(buildGroupMaps(parsed))
      }
      if (recRows?.length) {
        setRecipes(rowsToRecipes(recRows))
        setRecipeNames(rowsToRecipeNames(recRows))
      }
      if (taxonomyRows?.length) {
        const { allergens, diets, countries: taxCountries } = partitionTaxonomyRows(taxonomyRows)
        if (Object.keys(allergens).length)   setAllergenTypes(allergens)
        if (Object.keys(diets).length)       setDietTypes(diets)
        if (Object.keys(taxCountries).length) setCountries(taxCountries)
      }
      if (layoutRows?.length)   setFridgeLayouts(rowsToLangMap(layoutRows))
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
    }
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
  }), [ingredients, recipes, recipeNames, groupMaps, dietTypes, allergenTypes, countries, fridgeLayouts, lookup, ingredientsById, recipesById])

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
  const { recipes, recipeNames, recipesById } = useContext(DataContext)
  return { recipes, recipeNames, recipesById }
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
