// Phase L.2 : couche BDD pour les listes de courses sauvegardées.
//
// Table cible : `public.shopping_lists` (créée par la migration v3.51.0).
// Format : { id, user_id, name, items (jsonb), created_at, updated_at }.
//
// Le champ `items` est un snapshot des `basket_items` au moment de la
// sauvegarde — chaque item garde tous les champs nécessaires pour reconstruire
// le panier (ingredient_id, label, amount, unit, price, recipe_id, etc.).
//
// Limites BDD :
//   - 50 listes max par utilisateur (trigger BEFORE INSERT en BDD)
//   - name : 1-80 chars (CHECK constraint)
//   - RLS : utilisateur ne voit/modifie que ses propres listes
//
// Les fonctions ci-dessous renvoient toujours `{ data, error }` ou un fallback
// safe (array vide, null) pour ne pas casser l'UI si la BDD est indisponible.

import { supabase } from '@shared/lib/supabase/client'

/**
 * Charge toutes les listes d'un utilisateur, triées par dernière modification
 * descendante (la plus récente en premier).
 *
 * @param {string} userId
 * @returns {Promise<Array<{id, name, items, created_at, updated_at}>>}
 */
export async function loadShoppingLists(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id, name, items, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) {
    if (import.meta.env.DEV) console.error('[shopping_lists] loadShoppingLists:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Charge une liste par id (avec contrôle implicite via RLS).
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getShoppingList(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('id, name, items, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.error('[shopping_lists] getShoppingList:', error.message)
    return null
  }
  return data
}

/**
 * Crée une nouvelle liste à partir d'un snapshot d'items (typiquement le
 * panier courant). Le trigger BDD `check_shopping_lists_limit` rejette
 * l'INSERT si l'utilisateur a déjà 50 listes (erreur P0001).
 *
 * @param {string} userId
 * @param {string} name
 * @param {Array<object>} items - snapshot des basket_items
 * @returns {Promise<{ data: object|null, error: object|null }>}
 */
export async function createShoppingList(userId, name, items) {
  if (!userId || !name) {
    return { data: null, error: { message: 'missing_required_field' } }
  }
  const trimmed = String(name).trim()
  if (trimmed.length === 0 || trimmed.length > 80) {
    return { data: null, error: { message: 'invalid_name_length' } }
  }
  const safeItems = Array.isArray(items) ? items : []
  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({ user_id: userId, name: trimmed, items: safeItems })
    .select('id, name, items, created_at, updated_at')
    .single()
  if (error && import.meta.env.DEV) console.error('[shopping_lists] createShoppingList:', error.message)
  return { data, error }
}

/**
 * Met à jour une liste — le plus souvent un rename ou un remplacement
 * d'items (après édition). Le trigger BDD met à jour `updated_at`
 * automatiquement.
 *
 * @param {string} id
 * @param {object} fields - { name?, items? }
 * @returns {Promise<{ error: object|null }>}
 */
export async function updateShoppingList(id, fields) {
  if (!id) return { error: { message: 'missing_id' } }
  const update = {}
  if (typeof fields?.name === 'string') {
    const trimmed = fields.name.trim()
    if (trimmed.length === 0 || trimmed.length > 80) {
      return { error: { message: 'invalid_name_length' } }
    }
    update.name = trimmed
  }
  if (Array.isArray(fields?.items)) {
    update.items = fields.items
  }
  if (Object.keys(update).length === 0) {
    return { error: { message: 'no_fields_to_update' } }
  }
  const { error } = await supabase.from('shopping_lists').update(update).eq('id', id)
  if (error && import.meta.env.DEV) console.error('[shopping_lists] updateShoppingList:', error.message)
  return { error }
}

/**
 * Supprime une liste. RLS garantit que seul le propriétaire peut delete.
 *
 * @param {string} id
 * @returns {Promise<{ error: object|null }>}
 */
export async function deleteShoppingList(id) {
  if (!id) return { error: { message: 'missing_id' } }
  const { error } = await supabase.from('shopping_lists').delete().eq('id', id)
  if (error && import.meta.env.DEV) console.error('[shopping_lists] deleteShoppingList:', error.message)
  return { error }
}

/**
 * Compte les listes d'un utilisateur — utile pour l'UI (afficher « X / 50 »
 * avant de proposer la création d'une nouvelle liste).
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countShoppingLists(userId) {
  if (!userId) return 0
  const { count, error } = await supabase
    .from('shopping_lists')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[shopping_lists] countShoppingLists:', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Limite BDD (en miroir du trigger SQL `check_shopping_lists_limit`).
 * Exposée en constante pour cohérence UI/serveur.
 */
export const SHOPPING_LISTS_MAX_PER_USER = 50

/**
 * Limites de longueur du nom (en miroir du CHECK constraint SQL).
 */
export const SHOPPING_LIST_NAME_MIN = 1
export const SHOPPING_LIST_NAME_MAX = 80

/**
 * v3.55.0 — Calcule les ingrédients les plus fréquemment achetés par
 * l'utilisateur, en agrégeant les `items[]` de toutes ses `shopping_lists`
 * (snapshots des paniers passés).
 *
 * Source de vérité de l'historique : pas de table dédiée `purchase_history`.
 * On profite des snapshots des listes sauvegardées qui jouent ce rôle —
 * réutilise les données déjà persistées sans coût schema supplémentaire.
 *
 * Stratégie :
 *   1. Charger toutes les `shopping_lists` du user (jusqu'à 50)
 *   2. Pour chaque liste, parcourir `items[].ingredient_id`
 *   3. Compter les occurrences (1 par liste, pas par item — un ingrédient
 *      acheté 3 fois dans la même liste compte pour 1)
 *   4. Trier par compteur DESC, retourner les top-N
 *
 * Si `userId` absent ou aucun historique → renvoie un array vide. Le caller
 * doit alors retomber sur des suggestions par défaut (cf. EmptyBasketState).
 *
 * @param {string} userId
 * @param {number} [limit=5]
 * @returns {Promise<Array<{ingredient_id, count}>>} top-N triés DESC
 */
export async function getFrequentIngredients(userId, limit = 5) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('shopping_lists')
    .select('items')
    .eq('user_id', userId)
  if (error) {
    if (import.meta.env.DEV) console.error('[shopping_lists] getFrequentIngredients:', error.message)
    return []
  }
  const counts = new Map()
  for (const list of data ?? []) {
    if (!Array.isArray(list?.items)) continue
    // Set pour dédoublonner par liste (1 ingrédient acheté plusieurs fois
    // dans la même liste compte pour 1 — sinon les listes avec beaucoup
    // d'items du même ingrédient écrasent les autres)
    const seen = new Set()
    for (const item of list.items) {
      const id = item?.ingredient_id
      if (!id || seen.has(id)) continue
      seen.add(id)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ingredient_id, count]) => ({ ingredient_id, count }))
}
