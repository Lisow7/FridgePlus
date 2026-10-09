// Phase 8 launch (refonte Modales) PR 8.8.e. Mapping recette
// Fridge+ → Schema.org Recipe (https://schema.org/Recipe), injecté en
// `<script type="application/ld+json">` au mount d'une `<RecipeModal>`
// pour permettre aux recettes de remonter dans Google Recipe Cards
// (carrousel image + temps + note).
//
// Limites connues :
// - SPA = JSON-LD vu uniquement par les crawlers JS-aware (Googlebot OK
//   depuis 2019, Bing récemment). Pour un meilleur ranking, SSR/prerender
//   serait nécessaire (post-launch).
// - ~~Pas d'images de recette~~ → LEVÉ le 2026-08-13 : 99 des 515 recettes ont
//   désormais une photo (bucket `recipe-photos`, 1024×1024 WebP). Voir
//   `image` / `url` plus bas — Google exige name + image + url pour un
//   résultat enrichi, donc AUCUNE recette n'était éligible avant.
//
// Refonte Recettes P5b (D11) — champs enrichis :
//   prepTime, cookTime, description, datePublished, keywords, author Org,
//   nutrition NutritionInformation par portion.

import { computeRecipeNutrition } from '@shared/lib/recipes/recipe-nutrition'
import { getIngredientItemsFlat, ligneIngredient } from '@shared/lib/recipes/recipe-ingredients'
import { categorieSchemaOrg, cuisineSchemaOrg } from '@shared/lib/recipes/balisage-recette'

// Domaine de production, en dur et volontairement PAS `window.location.origin` :
//   - garde ce module pur et testable sans DOM ;
//   - l'URL d'identité d'une recette est son adresse de production, quel que
//     soit l'endroit d'où la page est servie.
// Une preview Vercel émettra donc une URL `fridgeplus.app` — sans conséquence,
// les previews étant servies en `X-Robots-Tag: noindex`.
const SITE_URL = 'https://fridgeplus.app'

// ── Helpers durée ────────────────────────────────────────────────────────────

// Convertit "20 min" / "1h30" / "2h" en ISO 8601 duration "PT20M" / "PT1H30M".
// Conservé pour compatibilité avec recipe.time (chaîne texte).
function toIsoDuration(timeStr) {
  if (!timeStr) return undefined
  const s = String(timeStr).toLowerCase().trim()
  // "1h30" ou "1h 30"
  const hm = s.match(/(\d+)\s*h\s*(\d+)/)
  if (hm) return `PT${hm[1]}H${hm[2]}M`
  // "1h" ou "2h"
  const h = s.match(/(\d+)\s*h(?!\d)/)
  if (h) return `PT${h[1]}H`
  // "20 min" / "20 minutes" / "20min"
  const m = s.match(/(\d+)\s*min/)
  if (m) return `PT${m[1]}M`
  // Nombre seul → minutes
  const n = s.match(/^(\d+)$/)
  if (n) return `PT${n[1]}M`
  return undefined
}

// Convertit un entier de minutes en ISO 8601 duration.
// Ex : 90 → 'PT1H30M', 60 → 'PT1H', 25 → 'PT25M'.
function minutesToIso(mins) {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return undefined
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `PT${h}H${m}M`
  if (h > 0)          return `PT${h}H`
  return `PT${m}M`
}

// ── Helpers nutrition ─────────────────────────────────────────────────────────
// Logique déplacée dans @shared/lib/recipes/recipe-nutrition (Phase 10b.3).
// La fonction computeRecipeNutrition y est importée ci-dessus.

// Type → `recipeCategory` et pays → `recipeCuisine` : `balisage-recette.js`,
// le module que lit aussi le pré-rendu (audit du 2026-10-04, SEO-13).

// ── Mapper principal ──────────────────────────────────────────────────────────

export function recipeToSchemaOrg({ recipe, recipeName, lang = 'fr', countries = {}, ingredientsById = null, reviewsAgg = null, authorName = null }) {
  if (!recipe) return null

  // ── Ingrédients : "200 g de pâtes" / "2 tomates" ─────────────────────────
  // Règle partagée avec le HTML pré-rendu (`ligneIngredient`, SEO-06).
  const recipeIngredient = getIngredientItemsFlat(recipe)
    .map(ing => ligneIngredient(ing, ingredientsById, lang))
    .filter(Boolean)

  // ── Instructions ──────────────────────────────────────────────────────────
  // custom recipes ont `steps[]` (array d'objets `{id, text}`).
  // Base recipes peuvent avoir `steps` en objet i18n `{ fr: [...], en: [...] }`
  // OU pas de steps du tout (description multi-paragraphes ailleurs).
  function normalizeSteps(stepsRaw) {
    if (!stepsRaw) return []
    if (Array.isArray(stepsRaw)) return stepsRaw
    if (typeof stepsRaw === 'object') {
      return stepsRaw[lang] ?? stepsRaw.fr ?? []
    }
    return []
  }
  const stepsArray = normalizeSteps(recipe.steps ?? recipe.instructions)
  const recipeInstructions = stepsArray
    .map(s => typeof s === 'string' ? s : (s?.text ?? ''))
    .filter(Boolean)
    .map(text => ({ '@type': 'HowToStep', text }))

  // ── Durées ────────────────────────────────────────────────────────────────
  // totalTime : champ texte hérité ("30 min", "1h30") ou time_min numérique
  const totalTime = minutesToIso(recipe.time_min) ?? toIsoDuration(recipe.time)
  const prepTime  = minutesToIso(recipe.prep_time_min)
  const cookTime  = minutesToIso(recipe.cook_time_min)

  // ── Autres champs de base ─────────────────────────────────────────────────
  const pays = recipe.country ? countries[recipe.country] : undefined
  const cuisine = pays
    ? cuisineSchemaOrg({ code: recipe.country, nom: pays.names?.[lang] ?? pays.names?.fr ?? recipe.country })
    : undefined
  const category = categorieSchemaOrg(recipe.type)
  const servings = recipe.servings
    ? `${recipe.servings} portions`
    : undefined

  // ── Champs D11 ───────────────────────────────────────────────────────────

  // description : JSONB {fr, en, ...} ou string brut
  let description
  if (recipe.description != null && typeof recipe.description === 'object') {
    description = recipe.description[lang] ?? recipe.description.fr ?? undefined
  } else if (typeof recipe.description === 'string' && recipe.description) {
    description = recipe.description
  }

  // datePublished : ISO date YYYY-MM-DD depuis created_at
  const datePublished = recipe.created_at
    ? new Date(recipe.created_at).toISOString().slice(0, 10)
    : undefined

  // keywords : diet[] + functional_tags[] joints par ", "
  const kwParts = [
    ...(Array.isArray(recipe.diet)           ? recipe.diet           : []),
    ...(Array.isArray(recipe.functional_tags) ? recipe.functional_tags : []),
  ].filter(Boolean)
  const keywords = kwParts.length > 0 ? kwParts.join(', ') : undefined

  // nutrition par portion (résolue depuis la BDD via ingredientsById — source unique)
  const rawNutrition = computeRecipeNutrition(recipe, ingredientsById)
  const nutrition = rawNutrition ? {
    '@type': 'NutritionInformation',
    calories:            `${Math.round(rawNutrition.kcal)} kcal`,
    proteinContent:      `${rawNutrition.protein.toFixed(1)} g`,
    carbohydrateContent: `${rawNutrition.carbs.toFixed(1)} g`,
    fatContent:          `${rawNutrition.fat.toFixed(1)} g`,
    ...(rawNutrition.fiber > 0 && { fiberContent: `${rawNutrition.fiber.toFixed(1)} g` }),
  } : undefined

  // ── Assemblage de l'objet de sortie ──────────────────────────────────────
  const out = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipeName,
    recipeIngredient,
    ...(recipeInstructions.length > 0 && { recipeInstructions }),
    ...(totalTime     && { totalTime }),
    ...(prepTime      && { prepTime }),
    ...(cookTime      && { cookTime }),
    ...(servings      && { recipeYield: servings }),
    ...(cuisine       && { recipeCuisine: cuisine }),
    ...(category      && { recipeCategory: category }),
    ...(description   && { description }),
    ...(datePublished && { datePublished }),
    ...(keywords      && { keywords }),
    ...(nutrition     && { nutrition }),
    inLanguage: lang,
  }

  // ── Auteur ────────────────────────────────────────────────────────────────
  // Author logic :
  //   - Custom/community recipe with username → Person
  //   - All other cases (officials sans flag origin, community sans username) → Organization
  const isCustomRecipe = recipe.isCustom === true || recipe.origin === 'community'
  if (isCustomRecipe && authorName) {
    out.author = { '@type': 'Person', name: authorName }
  } else {
    out.author = { '@type': 'Organization', name: 'Fridge+' }
  }

  // ── Les deux propriétés REQUISES par Google, absentes jusqu'au 2026-08-13 ──
  //
  // Google exige `name` + `image` + `url` pour un résultat enrichi de recette.
  // `name` était seul présent : AUCUNE des 515 recettes n'était éligible.
  //
  // `image` — uniquement si la recette a une vraie photo. 99 sur 515 en ont une
  // au 2026-08-13 ; les autres n'affichent qu'un emoji, qui n'est pas une image
  // au sens Schema.org. La condition de vérité couvre aussi la chaîne vide,
  // présente dans `recipes_unified.image_url`.
  //
  // ⚠️ Ces photos font 1024×1024 alors que Google RECOMMANDE ≥ 1200 px de large.
  // C'est en dessous de l'optimum, pas sous un minimum : la recette reste
  // éligible. Ré-encoder 99 photos est un chantier d'imagerie, pas celui-ci —
  // ne pas « corriger » ce point sans l'avoir décidé.
  if (recipe.image_url) out.image = recipe.image_url

  // `url` — l'adresse publique de la recette. Émise seulement si la page est
  // réellement atteignable : déclarer une URL que Google ne peut pas charger
  // est pire que ne rien déclarer. Les recettes officielles le sont toujours ;
  // une recette d'utilisateur ne l'est qu'une fois publiée (`useRecipeById`
  // rend `not-found` sinon, y compris pour une recette privée existante).
  const estPubliquementAtteignable = !isCustomRecipe || recipe.status === 'published'
  if (estPubliquementAtteignable && recipe.id) out.url = `${SITE_URL}/recipe/${recipe.id}`

  // ── Agrégat des avis ─────────────────────────────────────────────────────
  if (reviewsAgg && reviewsAgg.count > 0 && reviewsAgg.avg != null) {
    out.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewsAgg.avg,
      reviewCount: reviewsAgg.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return out
}
