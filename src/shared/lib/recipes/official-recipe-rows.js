// Une recette OFFICIELLE telle que la base la rend, et telle que l'app la lit.
//
// Deux lectures partagent ces définitions : le catalogue (`DataProvider`, toutes
// les recettes d'un coup) et la fiche ouverte par un lien direct
// (`getOfficialRecipeById`, une seule ligne — audit du 2026-10-04, PERF-02).
// Elles doivent rendre le MÊME objet : une fiche lue seule a la forme d'une
// fiche lue dans le catalogue, et aucun écran n'a à savoir d'où elle vient.
//
// Deux listes de colonnes. Le catalogue n'a ni les étapes (494 Ko) ni les
// descriptions (146 Ko) : 41 % des octets des 515 recettes (mesuré sur la base
// le 2026-10-05), qu'aucune liste, aucun filtre, aucune carte ne lit (PERF-01).
// La fiche les lit, elle, avec tout le reste.

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

export const OFFICIAL_RECIPE_COLUMNS =
  'id, name, emoji, time_min, prep_time_min, cook_time_min, difficulty, type, servings, country, diet, allergens, ingredients, image_url, status, promoted_from_id, promoted_at, original_author_id, original_author_name, created_at, functional_tags'

export const OFFICIAL_RECIPE_FULL_COLUMNS = `${OFFICIAL_RECIPE_COLUMNS}, description, steps`

function formatTimeMin(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// Le nom n'est PAS sur l'objet recette : il vit dans la map `recipeNames` du
// catalogue, que lisent le titre de l'onglet, la modale, l'impression…
// Une ligne du catalogue donne une recette SANS clé `steps` ni `description` :
// c'est ce qui dit à la fiche de lire la version complète (comme pour une
// recette embarquée).
export function rowToOfficialRecipe(row) {
  return {
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
    ...('description' in row ? { description: row.description ?? {} } : {}),   // multilingue : {fr, en, …}
    ...('steps' in row ? { steps: row.steps ?? {} } : {}),                     // multilingue : {fr: [...], …}
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
  }
}
